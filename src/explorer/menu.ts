import { buildIcon } from './icons'
import { clampMenuPosition, type Point } from './menuPosition'

export interface MenuItem {
  label: string
  iconPath?: string
  danger?: boolean
  onSelect: () => void
}

interface OpenMenu {
  el: HTMLElement
  anchor: HTMLElement | null
  teardown: () => void
}

let current: OpenMenu | null = null

export function closeMenu(): void {
  current?.teardown()
}

// 同じボタンから開いたメニューが既に開いているか（ボタンのクリックで開閉をトグルするため）
export function isMenuOpenFor(anchor: HTMLElement): boolean {
  return current?.anchor === anchor
}

function buildItem(item: MenuItem, select: (item: MenuItem) => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.setAttribute('role', 'menuitem')
  btn.className = [
    'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left whitespace-nowrap',
    'hover:bg-hover focus:bg-hover focus:outline-none cursor-pointer transition-colors',
    item.danger ? 'text-danger' : 'text-ink',
  ].join(' ')
  if (item.iconPath) btn.insertAdjacentHTML('beforeend', buildIcon(item.iconPath))
  const label = document.createElement('span')
  label.textContent = item.label
  btn.appendChild(label)
  btn.addEventListener('click', () => select(item))
  return btn
}

function moveFocus(buttons: HTMLButtonElement[], delta: number): void {
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = (index + delta + buttons.length) % buttons.length
  buttons[next].focus()
}

// 画面上の座標 at にメニューを開く。anchor は開いたボタン（閉じたときにフォーカスを戻す先）。
// 項目の選択・外側のクリック・Escape・スクロール/リサイズで閉じる。
export function openMenu(items: MenuItem[], at: Point, anchor: HTMLElement | null = null): void {
  closeMenu()

  const el = document.createElement('div')
  el.setAttribute('role', 'menu')
  el.className = 'fixed z-50 min-w-[11rem] py-1 rounded-lg border border-line bg-panel shadow-2xl'
  el.style.left = '0px'
  el.style.top = '0px'

  let tornDown = false
  function teardown(): void {
    if (tornDown) return
    tornDown = true
    el.remove()
    document.removeEventListener('pointerdown', onOutsidePointerDown, true)
    window.removeEventListener('resize', teardown)
    window.removeEventListener('blur', teardown)
    document.removeEventListener('scroll', teardown, true)
    if (current?.el === el) current = null
  }

  // 項目の選択後にメニューを閉じてから実行する（prompt/confirm を出す処理がメニューを残さないように）
  const buttons = items.map((item) => buildItem(item, (picked) => {
    teardown()
    picked.onSelect()
  }))
  el.append(...buttons)

  function onOutsidePointerDown(e: PointerEvent): void {
    const target = e.target as Node
    // 開いたボタン自身は click 側でトグルするためここでは閉じない
    if (el.contains(target) || anchor?.contains(target)) return
    teardown()
  }

  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      teardown()
      anchor?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveFocus(buttons, 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus(buttons, -1)
    } else if (e.key === 'Tab') {
      teardown()
    }
  })

  document.body.appendChild(el)
  const rect = el.getBoundingClientRect()
  const { left, top } = clampMenuPosition(
    at,
    { width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight },
  )
  el.style.left = `${left}px`
  el.style.top = `${top}px`

  document.addEventListener('pointerdown', onOutsidePointerDown, true)
  window.addEventListener('resize', teardown)
  window.addEventListener('blur', teardown)
  document.addEventListener('scroll', teardown, true)
  current = { el, anchor, teardown }
  buttons[0]?.focus()
}
