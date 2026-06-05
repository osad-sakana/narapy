export type LogKind = 'output' | 'result' | 'error' | 'info' | 'warn'

const LOG_CLASSES: Record<LogKind, string> = {
  output: 'text-slate-200',
  result: 'text-sky-300',
  error:  'text-red-400',
  info:   'text-slate-500',
  warn:   'text-amber-400',
}

const PLACEHOLDER_HTML = '<span class="text-slate-600 italic">実行結果がここに表示されます…</span>'

function getOutputLog(): HTMLDivElement {
  return document.getElementById('outputLog') as HTMLDivElement
}

function removePlaceholder(log: HTMLDivElement): void {
  log.querySelector('span')?.remove()
}

export function appendLog(text: string, kind: LogKind): void {
  const log = getOutputLog()
  removePlaceholder(log)

  const line = document.createElement('div')
  line.textContent = text
  line.className = LOG_CLASSES[kind]
  log.appendChild(line)
  log.scrollTop = log.scrollHeight
}

export interface ErrorBlock {
  line: number | null
  errorType: string
  description: string
  hint?: string
  raw: string
}

export function appendErrorBlock(block: ErrorBlock): void {
  const log = getOutputLog()
  removePlaceholder(log)

  const wrapper = document.createElement('div')
  wrapper.className = 'mt-1 mb-1 border-l-2 border-red-500/60 pl-3 space-y-0.5'

  // ヘッドライン: エラー種類 + 行番号
  const headline = document.createElement('div')
  const lineLabel = block.line !== null ? ` — ${block.line}行目` : ''
  headline.textContent = `[エラー] ${block.errorType}${lineLabel}`
  headline.className = 'text-red-400 font-bold text-xs'
  wrapper.appendChild(headline)

  // 日本語説明
  const desc = document.createElement('div')
  desc.textContent = block.description
  desc.className = 'text-red-300 text-sm'
  wrapper.appendChild(desc)

  // ヒント（任意）
  if (block.hint) {
    for (const hintLine of block.hint.split('\n')) {
      const hintEl = document.createElement('div')
      hintEl.textContent = `💡 ${hintLine}`
      hintEl.className = 'text-amber-300 text-xs'
      wrapper.appendChild(hintEl)
    }
  }

  // 元のエラー（折りたたみ）
  const details = document.createElement('details')
  details.className = 'mt-0.5'
  const summary = document.createElement('summary')
  summary.textContent = '元のエラーを表示'
  summary.className = 'text-slate-600 text-xs cursor-pointer hover:text-slate-400'
  const raw = document.createElement('pre')
  raw.textContent = block.raw
  raw.className = 'text-slate-600 text-xs mt-1 whitespace-pre-wrap break-all'
  details.appendChild(summary)
  details.appendChild(raw)
  wrapper.appendChild(details)

  log.appendChild(wrapper)
  log.scrollTop = log.scrollHeight
}

export function clearLog(): void {
  const outputLog = document.getElementById('outputLog') as HTMLDivElement
  outputLog.innerHTML = PLACEHOLDER_HTML
}

export function getLogText(): string {
  const outputLog = document.getElementById('outputLog') as HTMLDivElement
  return outputLog.innerText.trim()
}
