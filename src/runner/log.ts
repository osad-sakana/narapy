import { buildErrorIssueUrl } from './issueReport'

export type LogKind = 'output' | 'result' | 'error' | 'info' | 'warn'

const LOG_CLASSES: Record<LogKind, string> = {
  output: 'text-code',
  result: 'text-accent',
  error:  'text-danger',
  info:   'text-muted',
  warn:   'text-warn',
}

const PLACEHOLDER_HTML =
  '<span data-placeholder="true" data-log-exclude="true" class="text-muted italic">実行結果がここに表示されます…</span>'

function getOutputLog(): HTMLDivElement {
  return document.getElementById('outputLog') as HTMLDivElement
}

function removePlaceholder(log: HTMLDivElement): void {
  log.querySelector('[data-placeholder]')?.remove()
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
  matched?: boolean
  rawMessage?: string
}

// ルール未ヒットのエラーに「未対応」バッジ・英語原文・GitHub起票リンクを添える。
// リンクはクリックした時点でGitHubにエラー内容が送信されるため、その旨を文言で明示する
// （プライバシー配慮のため、こちらから自動送信することはない）
function buildUnmatchedFooter(block: ErrorBlock): HTMLElement {
  const footer = document.createElement('div')
  footer.className = 'space-y-0.5 mt-0.5'

  const badge = document.createElement('span')
  badge.textContent = '未対応'
  badge.title = '翻訳ルールが未対応のエラーです'
  badge.className = 'inline-block text-[10px] text-muted border border-line rounded px-1'
  badge.dataset.logExclude = 'true'
  footer.appendChild(badge)

  // generic ルールでは description に既に rawMessage の内容が含まれるため、二重表示を避ける。
  // rawMessage 自体はコピー時に有用な情報なので data-log-exclude は付けない
  if (block.rawMessage && !block.description.includes(block.rawMessage)) {
    const rawMsg = document.createElement('div')
    rawMsg.textContent = block.rawMessage
    rawMsg.className = 'text-muted text-xs'
    footer.appendChild(rawMsg)
  }

  const link = document.createElement('a')
  link.href = buildErrorIssueUrl({ errorType: block.errorType, raw: block.raw })
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'このエラーの日本語化をGitHubでリクエスト（クリックすると内容が送信されます・新しいタブで開きます）'
  link.className = 'text-accent text-xs underline hover:no-underline'
  link.dataset.logExclude = 'true'
  footer.appendChild(link)

  return footer
}

export function appendErrorBlock(block: ErrorBlock): void {
  const log = getOutputLog()
  removePlaceholder(log)

  const wrapper = document.createElement('div')
  wrapper.className = 'mt-1 mb-1 border-l-2 border-danger/60 pl-3 space-y-0.5'

  // ヘッドライン: エラー種類 + 行番号
  const headline = document.createElement('div')
  const lineLabel = block.line !== null ? ` — ${block.line}行目` : ''
  headline.textContent = `[エラー] ${block.errorType}${lineLabel}`
  headline.className = 'text-danger font-bold text-xs'
  wrapper.appendChild(headline)

  // 日本語説明
  const desc = document.createElement('div')
  desc.textContent = block.description
  desc.className = 'text-danger text-sm'
  wrapper.appendChild(desc)

  // ヒント（任意）
  if (block.hint) {
    for (const hintLine of block.hint.split('\n')) {
      const hintEl = document.createElement('div')
      hintEl.textContent = `💡 ${hintLine}`
      hintEl.className = 'text-warn text-xs'
      wrapper.appendChild(hintEl)
    }
  }

  // stderr は行単位で渡ってくるため、例外のトレースバックでない単なる文字列出力にまで
  // 「未対応」バッジと起票リンクが付くのを避ける
  if (block.matched === false && block.raw.includes('Traceback')) {
    wrapper.appendChild(buildUnmatchedFooter(block))
  }

  // 元のエラー（折りたたみ）
  const details = document.createElement('details')
  details.className = 'mt-0.5'
  const summary = document.createElement('summary')
  summary.textContent = '元のエラーを表示'
  summary.className = 'text-muted text-xs cursor-pointer hover:text-ink'
  summary.dataset.logExclude = 'true'
  const raw = document.createElement('pre')
  raw.textContent = block.raw
  raw.className = 'text-muted text-xs mt-1 whitespace-pre-wrap break-all'
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
  const clone = outputLog.cloneNode(true) as HTMLDivElement
  clone.removeAttribute('id')
  clone.querySelectorAll('[data-log-exclude]').forEach((el) => el.remove())

  // innerText はレイアウト計算に依存するため、画面外に配置した状態で計測する
  clone.style.position = 'absolute'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  document.body.appendChild(clone)
  try {
    return clone.innerText.trim()
  } finally {
    clone.remove()
  }
}
