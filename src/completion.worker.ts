/// <reference lib="webworker" />

import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from './lib/pyodideLoader'
import { AUTOPEP8_REQUIREMENTS, FORMAT_PY } from './format/formatModule'

type CompleteMessage = { type: 'complete'; id: number; code: string; line: number; col: number }
type FormatMessage = { type: 'format'; id: number; code: string }
type InMessage = CompleteMessage | FormatMessage

type OutMessage =
  | { type: 'ready' }
  | { type: 'completions'; id: number; items: Array<{ name: string; type: string }> }
  | { type: 'complete_error'; id: number }
  | { type: 'formatted'; id: number; result: unknown }
  | { type: 'format_error'; id: number }

interface LoadPackageOptions {
  messageCallback?: (msg: string) => void
  errorCallback?: (msg: string) => void
}

interface PyodideInterface {
  runPython: (code: string) => unknown
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[], options?: LoadPackageOptions) => Promise<void>
  globals: { set: (key: string, value: unknown) => void }
}

interface PyodideModule {
  loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>
}

let pyodide: PyodideInterface | null = null

// autopep8 は初回の整形時だけ導入する（補完の準備完了を PyPI 待ちにしないため）。
// 失敗したらメモを捨て、オフライン復帰後に再試行できるようにする。
let formatterReady: Promise<void> | null = null

function ensureFormatter(py: PyodideInterface): Promise<void> {
  if (formatterReady) return formatterReady
  const attempt = (async () => {
    await py.loadPackage('micropip', { messageCallback: () => undefined })
    py.globals.set('_reqs', AUTOPEP8_REQUIREMENTS)
    await py.runPythonAsync(`
import micropip as _mp
await _mp.install(list(_reqs))
`)
    py.runPython(FORMAT_PY)
  })()
  formatterReady = attempt
  attempt.catch(() => { if (formatterReady === attempt) formatterReady = null })
  return attempt
}

async function init(): Promise<void> {
  const { loadPyodide } = await verifiedImport(
    `${PYODIDE_CDN}pyodide.mjs`,
    PYODIDE_MJS_HASH,
  ) as PyodideModule

  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
  await pyodide.loadPackage(['jedi'], { messageCallback: () => undefined })

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

function isValidId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id)
}

function isCompleteMessage(msg: InMessage): msg is CompleteMessage {
  return (
    msg.type === 'complete' &&
    isValidId(msg.id) &&
    typeof msg.code === 'string' &&
    typeof msg.line === 'number' && Number.isInteger(msg.line) && msg.line >= 1 &&
    typeof msg.col === 'number' && Number.isInteger(msg.col) && msg.col >= 0
  )
}

function isFormatMessage(msg: InMessage): msg is FormatMessage {
  return msg.type === 'format' && isValidId(msg.id) && typeof msg.code === 'string'
}

async function handleFormat({ id, code }: FormatMessage): Promise<void> {
  try {
    await initPromise
    if (!pyodide) throw new Error('pyodide not ready')
    await ensureFormatter(pyodide)
    pyodide.globals.set('_fmt_src', code)
    const raw = pyodide.runPython('_narapy_format(_fmt_src)')
    const result: unknown = typeof raw === 'string' ? JSON.parse(raw) : null
    self.postMessage({ type: 'formatted', id, result } satisfies OutMessage)
  } catch {
    self.postMessage({ type: 'format_error', id } satisfies OutMessage)
  }
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data

  // ランタイムでメッセージ構造を検証することで型アサーション由来の不正入力を防ぐ
  if (!msg) return
  if (isFormatMessage(msg)) {
    await handleFormat(msg)
    return
  }
  if (!isCompleteMessage(msg)) return

  const { id, code, line, col } = msg

  try {
    await initPromise
    if (!pyodide) {
      self.postMessage({ type: 'complete_error', id } satisfies OutMessage)
      return
    }
    // line/col もglobals経由で渡してテンプレート文字列への直接埋込みを廃止
    pyodide.globals.set('_src', code)
    pyodide.globals.set('_line', line)
    pyodide.globals.set('_col', col)
    const result = pyodide.runPython('_complete(_src, _line, _col)')

    // runPythonの戻り値をランタイム検証してから使う（L-3）
    const json = typeof result === 'string' ? result : '[]'
    const parsed: unknown = JSON.parse(json)
    const items = Array.isArray(parsed)
      ? parsed.filter((item): item is { name: string; type: string } =>
          typeof item === 'object' && item !== null &&
          typeof (item as Record<string, unknown>).name === 'string' &&
          (item as Record<string, unknown>).name !== '' &&
          typeof (item as Record<string, unknown>).type === 'string',
        )
      : []

    self.postMessage({ type: 'completions', id, items } satisfies OutMessage)
  } catch {
    self.postMessage({ type: 'complete_error', id } satisfies OutMessage)
  }
}
