import type { WorkerMessage } from '../types'
import type { EditorInstance } from '../editor/index'
import { appendLog, clearLog } from './log'
import { getValue } from '../editor/index'

export function initRunner(editor: EditorInstance): void {
  const runBtn = document.getElementById('runBtn') as HTMLButtonElement
  const clearLogBtn = document.getElementById('clearLogBtn') as HTMLButtonElement

  const pyodideWorker = new Worker(
    new URL('../pyodide.worker.ts', import.meta.url),
    { type: 'module' }
  )

  pyodideWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type, payload } = event.data
    if (type === 'stdout') {
      appendLog(payload, 'output')
    } else if (type === 'result') {
      appendLog(`=> ${payload}`, 'result')
      runBtn.disabled = false
      runBtn.textContent = '▶ 実行'
    } else if (type === 'error') {
      appendLog(`[エラー] ${payload}`, 'error')
      runBtn.disabled = false
      runBtn.textContent = '▶ 実行'
    }
  }

  pyodideWorker.onerror = (err: ErrorEvent) => {
    appendLog(`[Worker エラー] ${err.message}`, 'error')
    runBtn.disabled = false
    runBtn.textContent = '▶ 実行'
  }

  runBtn.addEventListener('click', () => {
    const code = getValue(editor).trim()
    if (!code) return

    runBtn.disabled = true
    runBtn.textContent = '⏳ 実行中…'
    appendLog('--- 実行開始 ---', 'info')

    pyodideWorker.postMessage({ type: 'run', code })
  })

  clearLogBtn.addEventListener('click', clearLog)
}
