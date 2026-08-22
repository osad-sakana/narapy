export interface MenuAction {
  label: string
  onClick: () => void
}

export function initHamburgerMenu(actions: MenuAction[]): void {
  const btn = document.getElementById('hamburgerMenuBtn')
  const dropdown = document.getElementById('hamburgerMenuDropdown')
  if (!btn || !dropdown) return

  for (const action of actions) {
    const item = document.createElement('button')
    item.type = 'button'
    item.setAttribute('role', 'menuitem')
    item.className = 'w-full text-left px-3 py-2 text-xs text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer whitespace-nowrap'
    item.textContent = action.label
    item.addEventListener('click', () => {
      close()
      action.onClick()
    })
    dropdown.appendChild(item)
  }

  function isOpen(): boolean {
    return !dropdown!.classList.contains('hidden')
  }

  function open(): void {
    dropdown!.classList.remove('hidden')
    btn!.setAttribute('aria-expanded', 'true')
  }

  function close(): void {
    dropdown!.classList.add('hidden')
    btn!.setAttribute('aria-expanded', 'false')
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    isOpen() ? close() : open()
  })
  document.addEventListener('click', (e) => {
    if (isOpen() && e.target !== btn && !dropdown!.contains(e.target as Node)) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close()
  })
}
