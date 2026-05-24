import type { WorkerMessage } from '../types'
import { appendLog, clearLog } from './log'

export function initRunner(): void {
  const runBtn = document.getElementById('runBtn') as HTMLButtonElement
  const clearLogBtn = document.getElementById('clearLogBtn') as HTMLButtonElement
  const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement

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
    const code = codeEditor.value.trim()
    if (!code) return

    runBtn.disabled = true
    runBtn.textContent = '⏳ 実行中…'
    appendLog('--- 実行開始 ---', 'info')

    pyodideWorker.postMessage({ type: 'run', code })
  })

  clearLogBtn.addEventListener('click', clearLog)
}
