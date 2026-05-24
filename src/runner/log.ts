export type LogKind = 'output' | 'result' | 'error' | 'info' | 'warn'

const LOG_CLASSES: Record<LogKind, string> = {
  output: 'text-slate-200',
  result: 'text-sky-300',
  error:  'text-red-400',
  info:   'text-slate-500',
  warn:   'text-amber-400',
}

const PLACEHOLDER_HTML = '<span class="text-slate-600 italic">実行結果がここに表示されます…</span>'

export function appendLog(text: string, kind: LogKind): void {
  const outputLog = document.getElementById('outputLog') as HTMLDivElement
  const line = document.createElement('div')
  line.textContent = text
  line.className = LOG_CLASSES[kind]

  const placeholder = outputLog.querySelector('span')
  if (placeholder) placeholder.remove()

  outputLog.appendChild(line)
  outputLog.scrollTop = outputLog.scrollHeight
}

export function clearLog(): void {
  const outputLog = document.getElementById('outputLog') as HTMLDivElement
  outputLog.innerHTML = PLACEHOLDER_HTML
}
