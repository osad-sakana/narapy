/// <reference lib="webworker" />

interface RunMessage {
  type: 'run'
  code: string
}

interface OutMessage {
  type: 'stdout' | 'result' | 'error'
  payload: string
}

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[]) => Promise<void>
  globals: {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
  }
}

interface PyodideModule {
  loadPyodide: (options: {
    indexURL: string
    stdout?: (text: string) => void
    stderr?: (text: string) => void
  }) => Promise<PyodideInterface>
}

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'

let pyodide: PyodideInterface | null = null
let isReady = false

async function initPyodide(): Promise<void> {
  // module worker では importScripts() が禁止のため dynamic import() を使用
  const { loadPyodide } = await import(
    /* @vite-ignore */ `${PYODIDE_CDN}pyodide.mjs`
  ) as PyodideModule

  pyodide = await loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (text: string) => {
      const msg: OutMessage = { type: 'stdout', payload: text }
      self.postMessage(msg)
    },
    stderr: (text: string) => {
      const msg: OutMessage = { type: 'error', payload: text }
      self.postMessage(msg)
    },
  })

  isReady = true
}

const initPromise = initPyodide()

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  if (event.data.type !== 'run') return

  const { code } = event.data

  try {
    await initPromise

    if (!pyodide || !isReady) {
      const msg: OutMessage = { type: 'error', payload: 'Pyodide の初期化が完了していません' }
      self.postMessage(msg)
      return
    }

    const result = await pyodide.runPythonAsync(code)

    const msg: OutMessage = {
      type: 'result',
      payload: result === undefined || result === null ? '(None)' : String(result),
    }
    self.postMessage(msg)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const msg: OutMessage = { type: 'error', payload: message }
    self.postMessage(msg)
  }
}
