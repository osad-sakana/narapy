/// <reference lib="webworker" />

type InMessage = { type: 'complete'; id: number; code: string; line: number; col: number }

type OutMessage =
  | { type: 'ready' }
  | { type: 'completions'; id: number; items: Array<{ name: string; type: string }> }
  | { type: 'complete_error'; id: number }

interface PyodideInterface {
  runPython: (code: string) => unknown
  loadPackage: (names: string | string[]) => Promise<void>
  globals: { set: (key: string, value: unknown) => void }
}

interface PyodideModule {
  loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>
}

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'
const PYODIDE_MJS_HASH = 'sha384-99NUXWQ/+GiMxiBXXMq7KS8/e2HFz84pdM4eSR3j9E5Nmqxwv8jiOmm36bKkIGTL'

async function verifiedImport(url: string, expectedHash: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`fetch failed: ${url} (${response.status})`)

  const buffer = await response.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-384', buffer)
  const hashBase64 = btoa(
    Array.from(new Uint8Array(hashBuffer), (b) => String.fromCharCode(b)).join(''),
  )
  const actual = `sha384-${hashBase64}`
  if (actual !== expectedHash) throw new Error(`SRI mismatch: expected ${expectedHash}, got ${actual}`)

  const blob = new Blob([buffer], { type: 'text/javascript' })
  const blobUrl = URL.createObjectURL(blob)
  try {
    return await import(/* @vite-ignore */ blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

let pyodide: PyodideInterface | null = null

async function init(): Promise<void> {
  const { loadPyodide } = await verifiedImport(
    `${PYODIDE_CDN}pyodide.mjs`,
    PYODIDE_MJS_HASH,
  ) as PyodideModule

  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
  await pyodide.loadPackage(['jedi'])

  pyodide.runPython(`
import jedi as _jedi, json as _json

def _complete(source, line, col):
    try:
        comps = _jedi.Script(source=source).complete(line, col)
        return _json.dumps([{'name': c.name, 'type': c.type} for c in comps])
    except Exception:
        return '[]'
`)

  self.postMessage({ type: 'ready' } satisfies OutMessage)
}

const initPromise = init()

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const { type, id, code, line, col } = event.data
  if (type !== 'complete') return

  try {
    await initPromise
    if (!pyodide) {
      self.postMessage({ type: 'complete_error', id } satisfies OutMessage)
      return
    }
    // globals.setでコードを渡すことで、コード内の引用符によるエスケープ問題を回避
    pyodide.globals.set('_src', code)
    const json = pyodide.runPython(`_complete(_src, ${line}, ${col})`) as string
    const items = JSON.parse(json) as Array<{ name: string; type: string }>
    self.postMessage({ type: 'completions', id, items } satisfies OutMessage)
  } catch {
    self.postMessage({ type: 'complete_error', id } satisfies OutMessage)
  }
}
