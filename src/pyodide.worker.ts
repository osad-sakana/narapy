/// <reference lib="webworker" />

import type { RunFile, RunPayload } from './types'
import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from './lib/pyodideLoader'

type OutMessage =
  | { type: 'stdout' | 'error' | 'loading'; payload: string }
  | { type: 'result'; payload: string | null }
  | { type: 'image'; payload: string; title: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }
  | { type: 'interrupt_sab'; sab: SharedArrayBuffer }

interface PyFS {
  writeFile: (path: string, data: string | Uint8Array) => void
  mkdir: (path: string) => void
  analyzePath: (path: string) => { exists: boolean }
}

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[]) => Promise<void>
  loadPackagesFromImports: (code: string) => Promise<void>
  setInterruptBuffer: (buffer: Uint8Array) => void
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

// Pyodide への KeyboardInterrupt 注入用バッファ
// buffer[0] に 2（SIGINT）を書き込むと Python が KeyboardInterrupt を発生させる
const INTERRUPT_SAB = new SharedArrayBuffer(1)
const interruptBuffer = new Uint8Array(INTERRUPT_SAB)

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
  // SRI 検証（SHA-384）を経て CDN から直接ロードする
  const { loadPyodide } = await verifiedImport(
    `${PYODIDE_CDN}pyodide.mjs`,
    PYODIDE_MJS_HASH,
  ) as PyodideModule

  pyodide = await loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (text: string) => {
      self.postMessage({ type: 'stdout', payload: text } satisfies OutMessage)
    },
    stderr: (text: string) => {
      // フォントキャッシュ構築・欠落グリフ警告はログに表示しない
      if (
        text.includes('building the font cache') ||
        (text.includes('UserWarning') && text.includes('missing from'))
      ) return
      self.postMessage({ type: 'error', payload: text } satisfies OutMessage)
    },
  })

  // builtins.input を上書きして prompt 引数を直接受け取る
  pyodide.globals.set('input', customInput)

  // 停止シグナル用バッファを登録し、メインスレッドへ共有
  pyodide.setInterruptBuffer(interruptBuffer)
  self.postMessage({ type: 'interrupt_sab', sab: INTERRUPT_SAB } satisfies OutMessage)

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

  // Web Worker 内は document が存在しないため agg バックエンドを強制設定
  // japanize-matplotlib で日本語フォントを自動設定（初回のみダウンロード）
  if (pkgNames.includes('matplotlib')) {
    try {
      await pyodide.runPythonAsync(`import matplotlib as _mpl; _mpl.use('agg'); del _mpl`)
    } catch { /* ignore */ }
    try {
      await pyodide.runPythonAsync(`
import micropip as _mp
await _mp.install('japanize-matplotlib')
import japanize_matplotlib as _jmpl
del _mp, _jmpl
`)
    } catch { /* 日本語フォントなしで続行 */ }
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

async function cleanupUserModules(files: RunFile[]): Promise<void> {
  if (!pyodide) return
  const moduleNames = files
    .filter(f => f.kind === 'text' && f.path.endsWith('.py') && !f.path.includes('/'))
    .map(f => f.path.slice(0, -3))
  if (moduleNames.length === 0) return
  await pyodide.runPythonAsync(`
import sys, importlib as _il
for _m in ${JSON.stringify(moduleNames)}:
    sys.modules.pop(_m, None)
_il.invalidate_caches()
del _m, _il
`)
}

function ensureDir(absPath: string): void {
  if (!pyodide) return
  const parts = absPath.split('/').filter(Boolean)
  let cur = ''
  for (const p of parts) {
    cur += '/' + p
    if (!pyodide.FS.analyzePath(cur).exists) {
      try { pyodide.FS.mkdir(cur) } catch { /* race / already exists */ }
    }
  }
}

function getDirname(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return ''
  return path.slice(0, idx)
}

function writeFilesToFS(files: RunFile[], directories: string[]): void {
  if (!pyodide) return
  ensureDir(WORK_DIR)
  for (const dir of directories) {
    ensureDir(`${WORK_DIR}/${dir}`)
  }
  for (const file of files) {
    const dir = getDirname(file.path)
    if (dir) ensureDir(`${WORK_DIR}/${dir}`)
    const fullPath = `${WORK_DIR}/${file.path}`
    if (file.kind === 'text') {
      pyodide.FS.writeFile(fullPath, file.data)
    } else {
      pyodide.FS.writeFile(fullPath, file.data)
    }
  }
}

self.onmessage = async (event: MessageEvent<RunPayload>) => {
  if (event.data.type !== 'run') return

  const { code, files, directories } = event.data

  try {
    await initPromise

    if (!pyodide || !isReady) {
      self.postMessage({ type: 'error', payload: 'Pyodide の初期化が完了していません' } satisfies OutMessage)
      return
    }

    interruptBuffer[0] = 0 // 前回の停止シグナルをクリア
    await cleanupUserModules(files)
    writeFilesToFS(files, directories)
    await loadExternalPackages(code)

    const result = await pyodide.runPythonAsync(code)

    // matplotlib フィギュアを PNG として送信
    const figJson = await pyodide.runPythonAsync(EXTRACT_FIGS_CODE) as string
    const figs = JSON.parse(figJson) as Array<{ num: number; data: string }>
    for (const fig of figs) {
      self.postMessage({ type: 'image', payload: fig.data, title: `Figure ${fig.num}` } satisfies OutMessage)
    }

    // 最後の式が None の場合は REPL 同様にエコーしない（payload: null で表示を抑制）
    self.postMessage({
      type: 'result',
      payload: result === undefined || result === null ? null : String(result),
    } satisfies OutMessage)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', payload: message } satisfies OutMessage)
  }
}
