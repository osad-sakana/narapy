import {
  clampWidth,
  loadWidth,
  saveWidth,
  EXPLORER_WIDTH_DEFAULT,
  EXPLORER_WIDTH_MAX,
  EXPLORER_WIDTH_MIN,
  EXPLORER_WIDTH_STEP,
} from './width'

// エクスプローラーの右端に置く幅変更ハンドル。ドラッグ・矢印キー・ダブルクリック(既定幅に戻す)に対応する。
// 返す要素は container の子として render のたびに付け直す（innerHTML の入れ替えで消えるため）。
export function createResizeHandle(container: HTMLElement): HTMLElement {
  const handle = document.createElement('div')
  handle.className = 'absolute top-0 right-0 bottom-0 w-1.5 -mr-[3px] z-10 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 focus-visible:bg-accent/60 focus:outline-none transition-colors'
  handle.style.touchAction = 'none'
  handle.tabIndex = 0
  handle.setAttribute('role', 'separator')
  handle.setAttribute('aria-orientation', 'vertical')
  handle.setAttribute('aria-label', 'ファイル一覧の幅')
  handle.setAttribute('aria-valuemin', String(EXPLORER_WIDTH_MIN))
  handle.setAttribute('aria-valuemax', String(EXPLORER_WIDTH_MAX))
  handle.title = 'ドラッグで幅を変更（ダブルクリックで元に戻す）'

  function apply(width: number): number {
    const clamped = clampWidth(width)
    container.style.width = `${clamped}px`
    handle.setAttribute('aria-valuenow', String(clamped))
    return clamped
  }

  let currentWidth = apply(loadWidth())

  function commit(width: number): void {
    currentWidth = apply(width)
    saveWidth(currentWidth)
  }

  let drag: { startX: number; startWidth: number } | null = null

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    drag = { startX: e.clientX, startWidth: currentWidth }
    handle.setPointerCapture(e.pointerId)
    e.preventDefault()
  })
  handle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!drag) return
    currentWidth = apply(drag.startWidth + (e.clientX - drag.startX))
  })
  const endDrag = (): void => {
    if (!drag) return
    drag = null
    saveWidth(currentWidth)
  }
  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)

  handle.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') commit(currentWidth - EXPLORER_WIDTH_STEP)
    else if (e.key === 'ArrowRight') commit(currentWidth + EXPLORER_WIDTH_STEP)
    else return
    e.preventDefault()
  })
  handle.addEventListener('dblclick', () => commit(EXPLORER_WIDTH_DEFAULT))

  return handle
}
