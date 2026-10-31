/// <reference lib="webworker" />

import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from './lib/pyodideLoader'
import { parseCompletionItems, type RawCompletion } from './editor/completionMeta'

type InMessage = { type: 'complete'; id: number; code: string; line: number; col: number }

type OutMessage =
  | { type: 'ready' }
  | { type: 'completions'; id: number; items: RawCompletion[] }
  | { type: 'complete_error'; id: number }

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

  pyodide.runPython(`
import jedi as _jedi, json as _json

# parent() は jedi の推論を伴い重いので、先頭の候補だけメタ情報を付ける
_META_LIMIT = 150

def _meta(c):
    try:
        p = c.parent()
        return {'module': c.module_name or '', 'parent': p.name or '', 'parentType': p.type or ''}
    except Exception:
        return {}

def _complete(source, line, col):
    try:
        comps = _jedi.Script(source=source).complete(line, col)
        out = []
        for i, c in enumerate(comps):
            item = {'name': c.name, 'type': c.type}
            if i < _META_LIMIT:
                item.update(_meta(c))
            out.append(item)
        return _json.dumps(out)
    except Exception:
        return '[]'
`)

  self.postMessage({ type: 'ready' } satisfies OutMessage)
}

const initPromise = init()

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data

  // ランタイムでメッセージ構造を検証することで型アサーション由来の不正入力を防ぐ
  if (
    !msg ||
    msg.type !== 'complete' ||
    typeof msg.id !== 'number' || !Number.isInteger(msg.id) ||
    typeof msg.code !== 'string' ||
    typeof msg.line !== 'number' || !Number.isInteger(msg.line) || msg.line < 1 ||
    typeof msg.col !== 'number' || !Number.isInteger(msg.col) || msg.col < 0
  ) return

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
    const items = parseCompletionItems(parsed)

    self.postMessage({ type: 'completions', id, items } satisfies OutMessage)
  } catch {
    self.postMessage({ type: 'complete_error', id } satisfies OutMessage)
  }
}
