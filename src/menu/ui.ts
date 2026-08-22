export interface MenuAction {
  label: string
  onClick: () => void
}

export function initHamburgerMenu(actions: MenuAction[]): void {
  const btnEl = document.getElementById('hamburgerMenuBtn')
  const dropdownEl = document.getElementById('hamburgerMenuDropdown')
  if (!btnEl || !dropdownEl) return
  const btn = btnEl
  const dropdown = dropdownEl

  dropdown.replaceChildren()
  for (const action of actions) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'w-full text-left px-3 py-2 text-xs text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer whitespace-nowrap'
    item.textContent = action.label
    item.addEventListener('click', () => {
      close()
      action.onClick()
    })
    dropdown.appendChild(item)
  }

  function isOpen(): boolean {
    return !dropdown.classList.contains('hidden')
  }

  function open(): void {
    dropdown.classList.remove('hidden')
    btn.setAttribute('aria-expanded', 'true')
    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', handleKeydown)
  }

  function close(): void {
    dropdown.classList.add('hidden')
    btn.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', handleOutsideClick)
    document.removeEventListener('keydown', handleKeydown)
  }

  // stopPropagation に頼らず、クリック先がボタン/ドロップダウンの外かどうかで判定する
  // （将来 document レベルのクリックハンドラが増えても壊れない）
  function handleOutsideClick(e: MouseEvent): void {
    const target = e.target as Node
    if (!btn.contains(target) && !dropdown.contains(target)) close()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close()
      btn.focus()
    }
  }

  btn.addEventListener('click', () => {
    isOpen() ? close() : open()
  })
}
