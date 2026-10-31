const STORAGE_KEY = 'narapy.indentViz.width'

export const DEFAULT_WIDTH = 320
export const MIN_WIDTH = 200
const MAX_WIDTH = 800
// エディタ側が潰れないよう、ウィンドウ幅に対する上限も設ける
const MAX_WINDOW_RATIO = 0.6
const KEY_STEP = 16

/** 幅を許容範囲に収める。数値でない値は既定幅にする */
export function clampWidth(width: number, windowWidth: number): number {
  if (!Number.isFinite(width)) return DEFAULT_WIDTH
  const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(windowWidth * MAX_WINDOW_RATIO)))
  return Math.min(max, Math.max(MIN_WIDTH, Math.round(width)))
}

export function loadWidth(storage: Pick<Storage, 'getItem'> | null): number {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    return raw ? Number(raw) : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

export function saveWidth(storage: Pick<Storage, 'setItem'> | null, width: number): void {
  try {
    storage?.setItem(STORAGE_KEY, String(width))
  } catch {
    // 保存できなくてもリサイズ自体は使える
  }
}

export interface ResizeOptions {
  readonly panel: HTMLElement
  readonly handle: HTMLElement
  readonly initialWidth: number
  readonly onCommit: (width: number) => void
}

/**
 * パネル左端のハンドルをドラッグ（またはキーボード）で動かして幅を変える。
 * パネルは右端に固定されているので、左へ動かすほど広がる。
 */
export function attachResize({ panel, handle, initialWidth, onCommit }: ResizeOptions): void {
  let width = clampWidth(initialWidth, window.innerWidth)

  function apply(next: number): void {
    width = clampWidth(next, window.innerWidth)
    panel.style.width = `${width}px`
    handle.setAttribute('aria-valuenow', String(width))
  }

  handle.setAttribute('aria-valuemin', String(MIN_WIDTH))
  apply(width)

  handle.addEventListener('pointerdown', (down) => {
    down.preventDefault()
    const startX = down.clientX
    const startWidth = width
    handle.setPointerCapture(down.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: PointerEvent): void => apply(startWidth + (startX - e.clientX))
    const onEnd = (e: PointerEvent): void => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onCommit(width)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
  })

  handle.addEventListener('keydown', (e) => {
    const delta = e.key === 'ArrowLeft' ? KEY_STEP : e.key === 'ArrowRight' ? -KEY_STEP : 0
    if (delta === 0) return
    e.preventDefault()
    apply(width + delta)
    onCommit(width)
  })

  // ウィンドウを縮めたときに上限を超えたままにならないようにする
  window.addEventListener('resize', () => apply(width))
}
