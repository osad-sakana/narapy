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

  function setRunning(state: boolean): void {
    running = state
    if (state) {
      runBtn.className = STOP_STYLE
      runBtn.textContent = '■ 停止'
    } else {
      runBtn.className = RUN_STYLE
      runBtn.textContent = '▶ 実行'
    }
  }

  function attachWorkerHandlers(): void {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, payload } = event.data
      if (type === 'stdout') {
        appendLog(payload, 'output')
      } else if (type === 'result') {
        appendLog(`=> ${payload}`, 'result')
        setRunning(false)
      } else if (type === 'error') {
        const translated = translatePythonError(payload)
        if (translated) {
          appendErrorBlock({ ...translated, raw: payload })
        } else {
          appendLog(`[エラー] ${payload}`, 'error')
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
      worker.terminate()
      worker = createWorker()
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
