export function showFigureModal(base64: string, title: string): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-slate-800 rounded-xl shadow-2xl overflow-hidden max-w-3xl w-full flex flex-col'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-4 py-2 bg-slate-700 flex-shrink-0'

  const titleEl = document.createElement('span')
  titleEl.className = 'text-slate-200 text-sm font-medium'
  titleEl.textContent = `📊 ${title}`

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-slate-400 hover:text-white text-xl font-bold transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-slate-600'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')

  const imgContainer = document.createElement('div')
  imgContainer.className = 'overflow-auto p-2 flex items-center justify-center bg-white'

  const img = document.createElement('img')
  img.src = `data:image/png;base64,${base64}`
  img.className = 'max-w-full max-h-[80vh] object-contain'
  img.alt = title

  header.appendChild(titleEl)
  header.appendChild(closeBtn)
  imgContainer.appendChild(img)
  card.appendChild(header)
  card.appendChild(imgContainer)
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
