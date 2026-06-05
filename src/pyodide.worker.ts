/// <reference lib="webworker" />

import type { RunPayload } from './types'

type OutMessage =
  | { type: 'stdout' | 'result' | 'error' | 'loading'; payload: string }
  | { type: 'image'; payload: string; title: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }

interface PyFS {
  writeFile: (path: string, data: string) => void
}

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[]) => Promise<void>
  loadPackagesFromImports: (code: string) => Promise<void>
  globals: {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
  }
  FS: PyFS
}

interface PyodideModule {
  loadPyodide: (options: {
    indexURL: string
    stdout?: (text: string) => void
    stderr?: (text: string) => void
  }) => Promise<PyodideInterface>
}

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'
const WORK_DIR = '/home/pyodide'

// 実行後に matplotlib の全フィギュアを PNG base64 の JSON 配列として返す
const EXTRACT_FIGS_CODE = `
import sys as _sys, json as _json
_result = []
if 'matplotlib.pyplot' in _sys.modules:
    import matplotlib.pyplot as _plt, io as _io, base64 as _b64
    for _n in _plt.get_fignums():
        _buf = _io.BytesIO()
        _plt.figure(_n).savefig(_buf, format='png', bbox_inches='tight', dpi=100)
        _buf.seek(0)
        _result.append({'num': _n, 'data': _b64.b64encode(_buf.read()).decode()})
    _plt.close('all')
_json.dumps(_result)
`

// SharedArrayBuffer で stdin の同期通信を行う
// [0..3] Int32: 0=idle, N>0=入力データのバイト数
// [4..]  Uint8: UTF-8 エンコードされた入力データ（最大 4092 バイト）
const INPUT_SAB = new SharedArrayBuffer(4 + 4092)
const inputStatus = new Int32Array(INPUT_SAB, 0, 1)
const inputData = new Uint8Array(INPUT_SAB, 4)

// 起動直後にSABをメインスレッドへ送り、input_request の受け取り準備をさせる
self.postMessage({ type: 'input_sab', sab: INPUT_SAB } satisfies OutMessage)

// Python の input(prompt) を直接置き換える関数。
// stdin オプションではなく globals.set を使うことで：
// (1) stdout にプロンプトが流れないためログが汚れない
// (2) prompt 引数を直接受け取れる
function customInput(prompt: unknown): string {
  const promptStr = String(prompt ?? '')
  Atomics.store(inputStatus, 0, 0)
  self.postMessage({ type: 'input_request', prompt: promptStr } satisfies OutMessage)
  Atomics.wait(inputStatus, 0, 0)
  const len = Atomics.load(inputStatus, 0)
  if (len < 0) return '' // キャンセル
  const bytes = inputData.slice(0, len)
  return new TextDecoder().decode(bytes)
}

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
      self.postMessage({ type: 'stdout', payload: text } satisfies OutMessage)
    },
    stderr: (text: string) => {
      self.postMessage({ type: 'error', payload: text } satisfies OutMessage)
    },
  })

  // builtins.input を上書きして prompt 引数を直接受け取る
  pyodide.globals.set('input', customInput)

  isReady = true
}

const initPromise = initPyodide()

function extractTopLevelImports(code: string): string[] {
  const names = new Set<string>()
  for (const line of code.split('\n')) {
    const trimmed = line.trim()
    const importMatch = trimmed.match(/^import\s+([\w.]+)/)
    if (importMatch) {
      names.add(importMatch[1].split('.')[0])
    }
    const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import/)
    if (fromMatch) {
      names.add(fromMatch[1].split('.')[0])
    }
  }
  return [...names]
}

async function loadExternalPackages(code: string): Promise<void> {
  if (!pyodide) return

  const pkgNames = extractTopLevelImports(code)
  if (pkgNames.length === 0) return

  self.postMessage({
    type: 'loading',
    payload: `パッケージをロード中: ${pkgNames.join(', ')} ...`,
  } satisfies OutMessage)

  // Pyodide バンドル済みパッケージ（numpy, pandas 等）を自動ロード
  try {
    await pyodide.loadPackagesFromImports(code)
  } catch {
    // バンドル外は micropip にフォールバック
  }

  // バンドルにないパッケージを micropip でインストール
  try {
    await pyodide.runPythonAsync(`
import micropip as _mp
_pkgs = ${JSON.stringify(pkgNames)}
for _p in _pkgs:
    try:
        __import__(_p)
    except ImportError:
        await _mp.install(_p)
del _mp, _pkgs, _p
`)
  } catch {
    // micropip 失敗は実行時エラーとして表面化する
  }
}

async function cleanupUserModules(files: Record<string, string>): Promise<void> {
  if (!pyodide) return
  const moduleNames = Object.keys(files)
    .filter(name => name.endsWith('.py'))
    .map(name => name.slice(0, -3))
  if (moduleNames.length === 0) return
  await pyodide.runPythonAsync(`
import sys, importlib as _il
for _m in ${JSON.stringify(moduleNames)}:
    sys.modules.pop(_m, None)
_il.invalidate_caches()
del _m, _il
`)
}

function writeFilesToFS(files: Record<string, string>): void {
  if (!pyodide) return
  for (const [name, content] of Object.entries(files)) {
    pyodide.FS.writeFile(`${WORK_DIR}/${name}`, content)
  }
}

self.onmessage = async (event: MessageEvent<RunPayload>) => {
  if (event.data.type !== 'run') return

  const { code, files } = event.data

  try {
    await initPromise

    if (!pyodide || !isReady) {
      self.postMessage({ type: 'error', payload: 'Pyodide の初期化が完了していません' } satisfies OutMessage)
      return
    }

    await cleanupUserModules(files)
    writeFilesToFS(files)
    await loadExternalPackages(code)

    const result = await pyodide.runPythonAsync(code)

    // matplotlib フィギュアを PNG として送信
    const figJson = await pyodide.runPythonAsync(EXTRACT_FIGS_CODE) as string
    const figs = JSON.parse(figJson) as Array<{ num: number; data: string }>
    for (const fig of figs) {
      self.postMessage({ type: 'image', payload: fig.data, title: `Figure ${fig.num}` } satisfies OutMessage)
    }

    self.postMessage({
      type: 'result',
      payload: result === undefined || result === null ? '(None)' : String(result),
    } satisfies OutMessage)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', payload: message } satisfies OutMessage)
  }
}
