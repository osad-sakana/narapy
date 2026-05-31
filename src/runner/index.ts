import type { WorkerMessage } from '../types'
import type { EditorInstance } from '../editor/index'
import { appendLog, appendErrorBlock, clearLog } from './log'
import { getValue } from '../editor/index'
import { translatePythonError } from './errorTranslator'

const RUN_STYLE  = 'flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-bold transition-colors shadow-md shadow-violet-900/50 cursor-pointer'
const STOP_STYLE = 'flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-bold transition-colors shadow-md shadow-red-900/50 cursor-pointer'

function createWorker(): Worker {
  return new Worker(
    new URL('../pyodide.worker.ts', import.meta.url),
    { type: 'module' },
  )
}

export function initRunner(editor: EditorInstance): void {
  const runBtn      = document.getElementById('runBtn')      as HTMLButtonElement
  const clearLogBtn = document.getElementById('clearLogBtn') as HTMLButtonElement

  let worker  = createWorker()
  let running = false

  // Worker ごとに SAB が変わるのでクロージャで管理
  let inputStatus: Int32Array | null = null
  let inputData: Uint8Array | null = null
  // input() の直前に stdout で出力されたプロンプト文字列を追跡
  let lastStdout = ''

  function setRunning(state: boolean): void {
    running = state
    if (state) {
      lastStdout = ''
      runBtn.className = STOP_STYLE
      runBtn.textContent = '■ 停止'
    } else {
      runBtn.className = RUN_STYLE
      runBtn.textContent = '▶ 実行'
    }
  }

  function attachWorkerHandlers(): void {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data

      if (msg.type === 'input_sab') {
        inputStatus = new Int32Array(msg.sab, 0, 1)
        inputData   = new Uint8Array(msg.sab, 4)
        return
      }

      if (msg.type === 'input_request') {
        // input("プロンプト") の文字列は直前の stdout に出ているので lastStdout を使う
        const prompt = lastStdout.trimEnd() || 'input()'
        lastStdout = ''
        const value = window.prompt(prompt)
        if (inputStatus && inputData) {
          if (value === null) {
            // キャンセル → EOF (-1)
            Atomics.store(inputStatus, 0, -1)
          } else {
            const encoded = new TextEncoder().encode(value)
            inputData.set(encoded)
            Atomics.store(inputStatus, 0, encoded.length)
          }
          Atomics.notify(inputStatus, 0)
        }
        return
      }

      if (msg.type === 'stdout') {
        appendLog(msg.payload, 'output')
        lastStdout = msg.payload
      } else if (msg.type === 'result') {
        appendLog(`=> ${msg.payload}`, 'result')
        setRunning(false)
      } else if (msg.type === 'error') {
        const translated = translatePythonError(msg.payload)
        if (translated) {
          appendErrorBlock({ ...translated, raw: msg.payload })
        } else {
          appendLog(`[エラー] ${msg.payload}`, 'error')
        }
        setRunning(false)
      }
    }

    worker.onerror = (err: ErrorEvent) => {
      appendLog(`[Worker エラー] ${err.message}`, 'error')
      setRunning(false)
    }
  }

  attachWorkerHandlers()

  runBtn.addEventListener('click', () => {
    if (running) {
      // 強制停止: Worker を破棄して新規作成
      worker.terminate()
      worker = createWorker()
      inputStatus = null
      inputData   = null
      attachWorkerHandlers()
      appendLog('--- 実行を停止しました ---', 'info')
      setRunning(false)
      return
    }

    const code = getValue(editor).trim()
    if (!code) return

    setRunning(true)
    appendLog('--- 実行開始 ---', 'info')
    worker.postMessage({ type: 'run', code })
  })

  clearLogBtn.addEventListener('click', clearLog)
}
