/// <reference lib="webworker" />

import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from './lib/pyodideLoader'
import completionHelperSource from './completion_helper.py?raw'
import { parseCompletionItems, type CompletionWorkerOut } from './editor/completionMeta'

type RequestType = 'complete' | 'hover' | 'signature'
type InMessage = { type: RequestType; id: number; code: string; line: number; col: number }

// 呼び出す Python 関数名は固定の対応表から選ぶ（メッセージ由来の文字列を実行に使わない）
const PY_FUNCTIONS: Record<RequestType, string> = {
  complete: '_complete',
  hover: '_hover',
  signature: '_signature',
}

type OutMessage = CompletionWorkerOut

interface LoadPackageOptions {
  messageCallback?: (msg: string) => void
  errorCallback?: (msg: string) => void
}

interface PyodideInterface {
  runPython: (code: string) => unknown
  loadPackage: (names: string | string[], options?: LoadPackageOptions) => Promise<void>
  globals: { set: (key: string, value: unknown) => void }
}

interface PyodideModule {
  loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>
}

let pyodide: PyodideInterface | null = null

async function init(): Promise<void> {
  const { loadPyodide } = await verifiedImport(
    `${PYODIDE_CDN}pyodide.mjs`,
    PYODIDE_MJS_HASH,
  ) as PyodideModule

  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
  await pyodide.loadPackage(['jedi'], { messageCallback: () => undefined })

  pyodide.runPython(completionHelperSource)

  self.postMessage({ type: 'ready' } satisfies OutMessage)
}

const initPromise = init()

function postFailure(type: RequestType, id: number): void {
  const out: OutMessage =
    type === 'complete' ? { type: 'complete_error', id } : { type: 'query_result', id, value: null }
  self.postMessage(out)
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data

  // ランタイムでメッセージ構造を検証することで型アサーション由来の不正入力を防ぐ
  if (
    !msg ||
    !(msg.type in PY_FUNCTIONS) ||
    typeof msg.id !== 'number' || !Number.isInteger(msg.id) ||
    typeof msg.code !== 'string' ||
    typeof msg.line !== 'number' || !Number.isInteger(msg.line) || msg.line < 1 ||
    typeof msg.col !== 'number' || !Number.isInteger(msg.col) || msg.col < 0
  ) return

  const { id, code, line, col } = msg

  try {
    await initPromise
    if (!pyodide) {
      postFailure(msg.type, id)
      return
    }
    // line/col もglobals経由で渡してテンプレート文字列への直接埋込みを廃止
    pyodide.globals.set('_src', code)
    pyodide.globals.set('_line', line)
    pyodide.globals.set('_col', col)
    const result = pyodide.runPython(`${PY_FUNCTIONS[msg.type]}(_src, _line, _col)`)

    // runPythonの戻り値をランタイム検証してから使う（L-3）
    const json = typeof result === 'string' ? result : 'null'
    const parsed: unknown = JSON.parse(json)

    if (msg.type === 'complete') {
      self.postMessage({ type: 'completions', id, items: parseCompletionItems(parsed) } satisfies OutMessage)
    } else {
      self.postMessage({ type: 'query_result', id, value: parsed } satisfies OutMessage)
    }
  } catch {
    postFailure(msg.type, id)
  }
}
