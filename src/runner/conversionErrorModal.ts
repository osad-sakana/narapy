export function showConversionErrorModal(message: string): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl overflow-hidden max-w-2xl w-full flex flex-col max-h-[80vh]'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-4 py-2 bg-panel border-b border-line flex-shrink-0'

  const titleEl = document.createElement('span')
  titleEl.className = 'text-danger text-sm font-medium'
  titleEl.textContent = '⚠ 変換エラーの詳細'

  const actions = document.createElement('div')
  actions.className = 'flex items-center gap-2'

  const copyBtn = document.createElement('button')
  copyBtn.className = 'flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded hover:bg-hover'
  copyBtn.innerHTML = `<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>コピー`

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-muted hover:text-ink text-xl font-bold transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-hover'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')

  const body = document.createElement('div')
  body.className = 'overflow-auto p-4 flex-1'

  const pre = document.createElement('pre')
  pre.className = 'text-danger text-xs font-mono whitespace-pre-wrap break-all leading-relaxed'
  pre.textContent = message

  actions.appendChild(copyBtn)
  actions.appendChild(closeBtn)
  header.appendChild(titleEl)
  header.appendChild(actions)
  body.appendChild(pre)
  card.appendChild(header)
  card.appendChild(body)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const close = (): void => {
    backdrop.remove()
    document.removeEventListener('keydown', handleKey)
  }

  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }

  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(message)
    const originalHTML = copyBtn.innerHTML
    copyBtn.textContent = '✓ コピーしました'
    copyBtn.classList.add('text-success')
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML
      copyBtn.classList.remove('text-success')
    }, 1500)
  })

  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', handleKey)
}
