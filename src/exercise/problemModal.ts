// 問題文(problem.md)を表示するモーダル(issue #65)。
// #project=/?project=<URL> 経由で第三者が用意した .exercise を開ける仕様上、
// problem.md の中身は信頼できない入力として扱う必要がある。Markdownのレンダリング
// （innerHTML等）はここでは行わず、textContentでエスケープしたまま pre-wrap で
// 改行だけ保持して表示する（書式付き表示は将来課題）。
export function showProblemModal(problemText: string): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[80vh] flex flex-col'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-4 py-2 bg-panel border-b border-line flex-shrink-0'

  const titleEl = document.createElement('span')
  titleEl.className = 'text-ink text-sm font-medium'
  titleEl.textContent = '📄 問題'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-muted hover:text-ink text-xl font-bold transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-hover'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')

  const body = document.createElement('pre')
  body.className = 'overflow-auto p-4 text-sm text-ink whitespace-pre-wrap break-words font-sans flex-1'
  body.textContent = problemText

  header.append(titleEl, closeBtn)
  card.append(header, body)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const close = (): void => {
    backdrop.remove()
    document.removeEventListener('keydown', handleKey)
  }

  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }

  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', handleKey)
}
