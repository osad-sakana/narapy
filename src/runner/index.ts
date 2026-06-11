import type { WorkerMessage, RunFile, RunPayload } from '../types'
import type { EditorInstance } from '../editor/index'
import { appendLog, appendErrorBlock, clearLog, getLogText } from './log'
import { getValue } from '../editor/index'
import { translatePythonError } from './errorTranslator'
import { showFigureModal } from './figureModal'

const RUN_STYLE  = 'flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-bold transition-colors shadow-md shadow-violet-900/50 cursor-pointer'
const STOP_STYLE = 'flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-bold transition-colors shadow-md shadow-red-900/50 cursor-pointer'

// 60 秒間応答がなければ Worker を強制終了する
const EXECUTION_TIMEOUT_MS = 60_000
// KeyboardInterrupt 後、800ms 以内に完了しなければ強制終了にフォールバック
const INTERRUPT_FALLBACK_MS = 800

function createWorker(): Worker {
  return new Worker(
    new URL('../pyodide.worker.ts', import.meta.url),
    { type: 'module' },
  )
}

export function initRunner(
  editor: EditorInstance,
  getRunFiles: () => { files: RunFile[]; directories: string[] },
): void {
  const runBtn     = document.getElementById('runBtn')     as HTMLButtonElement
  const copyLogBtn = document.getElementById('copyLogBtn') as HTMLButtonElement

  let worker  = createWorker()
  let running = false

  // Worker ごとに SAB が変わるのでクロージャで管理
  let inputStatus: Int32Array | null = null
  let inputData: Uint8Array | null = null
  let interruptBuffer: Uint8Array | null = null
  let executionTimeoutId: ReturnType<typeof setTimeout> | null = null

  function clearExecutionTimeout(): void {
    if (executionTimeoutId !== null) {
      clearTimeout(executionTimeoutId)
      executionTimeoutId = null
    }
  }

  function setRunning(state: boolean): void {
    running = state
    if (state) {
      runBtn.className = STOP_STYLE
      runBtn.textContent = '■ 停止'
      executionTimeoutId = setTimeout(() => {
        if (!running) return
        hardStop()
        appendLog(`--- タイムアウト（${EXECUTION_TIMEOUT_MS / 1000}秒）で強制停止しました ---`, 'warn')
      }, EXECUTION_TIMEOUT_MS)
    } else {
      runBtn.className = RUN_STYLE
      runBtn.textContent = '▶ 実行'
      clearExecutionTimeout()
    }
  }

  // Worker を終了して再生成する（メモリ枯渇・タイムアウト・フォールバック用）
  function hardStop(): void {
    clearExecutionTimeout()
    worker.terminate()
    worker = createWorker()
    inputStatus = null
    inputData = null
    interruptBuffer = null
    attachWorkerHandlers()
    setRunning(false)
  }

  // interrupt buffer で KeyboardInterrupt を注入し、800ms 後も停止していなければ hardStop
  function gracefulStop(): void {
    if (interruptBuffer) {
      interruptBuffer[0] = 2 // SIGINT → Python が KeyboardInterrupt を発生させる
    }
    setTimeout(() => {
      if (running) hardStop()
    }, INTERRUPT_FALLBACK_MS)
  }

  function attachWorkerHandlers(): void {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data

      if (msg.type === 'input_sab') {
        inputStatus = new Int32Array(msg.sab, 0, 1)
        inputData   = new Uint8Array(msg.sab, 4)
        return
      }

      if (msg.type === 'interrupt_sab') {
        interruptBuffer = new Uint8Array(msg.sab)
        return
      }

      if (msg.type === 'input_request') {
        const value = window.prompt(msg.prompt || 'input()')
        if (inputStatus && inputData) {
          if (value === null) {
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

      if (msg.type === 'loading') {
        appendLog(msg.payload, 'info')
        return
      }

      if (msg.type === 'image') {
        showFigureModal(msg.payload, msg.title)
        return
      }

      if (msg.type === 'stdout') {
        appendLog(msg.payload, 'output')
      } else if (msg.type === 'result') {
        appendLog(`=> ${msg.payload}`, 'result')
        setRunning(false)
      } else if (msg.type === 'error') {
        // KeyboardInterrupt は停止操作によるものなので通常のエラー表示をしない
        if (msg.payload.includes('KeyboardInterrupt')) {
          appendLog('--- 実行を停止しました ---', 'info')
        } else {
          const translated = translatePythonError(msg.payload)
          if (translated) {
            appendErrorBlock({ ...translated, raw: msg.payload })
          } else {
            appendLog(`[エラー] ${msg.payload}`, 'error')
          }
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
      if (interruptBuffer) {
        // Pyodide が準備済みであれば graceful stop を試みる
        gracefulStop()
        appendLog('--- 停止シグナルを送信しました ---', 'info')
      } else {
        // Pyodide 初期化中は interrupt buffer が未取得なので即座に強制停止
        hardStop()
        appendLog('--- 実行を強制停止しました ---', 'info')
      }
      return
    }

    const code = getValue(editor).trim()
    if (!code) return

    setRunning(true)
    clearLog()
    appendLog('--- 実行開始 ---', 'info')
    const { files, directories } = getRunFiles()
    worker.postMessage({ type: 'run', code, files, directories } satisfies RunPayload)
  })

  copyLogBtn.addEventListener('click', async () => {
    const text = getLogText()
    if (!text) return
    await navigator.clipboard.writeText(text)
    const originalHTML = copyLogBtn.innerHTML
    copyLogBtn.textContent = '✓ コピーしました'
    copyLogBtn.classList.add('text-emerald-300')
    setTimeout(() => {
      copyLogBtn.innerHTML = originalHTML
      copyLogBtn.classList.remove('text-emerald-300')
    }, 1500)
  })
}
