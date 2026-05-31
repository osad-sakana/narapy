/// <reference lib="webworker" />

interface RunMessage {
  type: 'run'
  code: string
}

type OutMessage =
  | { type: 'stdout' | 'result' | 'error'; payload: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }

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

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  if (event.data.type !== 'run') return

  const { code } = event.data

  try {
    await initPromise

    if (!pyodide || !isReady) {
      self.postMessage({ type: 'error', payload: 'Pyodide の初期化が完了していません' } satisfies OutMessage)
      return
    }

    const result = await pyodide.runPythonAsync(code)

    self.postMessage({
      type: 'result',
      payload: result === undefined || result === null ? '(None)' : String(result),
    } satisfies OutMessage)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', payload: message } satisfies OutMessage)
  }
}
