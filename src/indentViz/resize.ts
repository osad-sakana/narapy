const STORAGE_KEY = 'narapy.indentViz.width'

export const DEFAULT_WIDTH = 320
export const MIN_WIDTH = 200
const MAX_WIDTH = 800
// エディタ列が潰れないよう確保する最小幅
const MIN_EDITOR_WIDTH = 320
const KEY_STEP = 16

/** 幅を [MIN_WIDTH, maxWidth] に収める。数値でない値は既定幅として扱う */
export function clampWidth(width: number, maxWidth: number): number {
  const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(maxWidth)))
  const wanted = Number.isFinite(width) ? width : DEFAULT_WIDTH
  return Math.min(max, Math.max(MIN_WIDTH, Math.round(wanted)))
}

/**
 * パネルに割ける最大幅。同じ行に並ぶ固定幅の兄弟（ファイルエクスプローラーや
 * ステップ実行パネル）とエディタの最小幅を差し引く。flex-1 の兄弟はエディタ列なので数えない。
 */
export function availableWidth(panel: HTMLElement): number {
  const row = panel.parentElement
  if (!row) return MAX_WIDTH
  const fixed = [...row.children]
    .filter((el): el is HTMLElement => el instanceof HTMLElement && el !== panel && !el.classList.contains('flex-1'))
    .reduce((sum, el) => sum + el.offsetWidth, 0)
  return row.clientWidth - fixed - MIN_EDITOR_WIDTH
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
  /** 今パネルに割ける最大幅（他の固定幅パネルの開閉で変わる） */
  readonly getMaxWidth: () => number
  readonly onCommit: (width: number) => void
}

/**
 * パネル左端のハンドルをドラッグ（またはキーボード）で動かして幅を変える。
 * パネルは右端に固定されているので、左へ動かすほど広がる。
 */
export function attachResize({ panel, handle, initialWidth, getMaxWidth, onCommit }: ResizeOptions): void {
  // 希望幅と実際に適用した幅を分ける。ウィンドウを縮めてから広げたら希望幅へ戻れるようにする
  let desired = clampWidth(initialWidth, getMaxWidth())

  function apply(): number {
    const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(getMaxWidth())))
    const width = clampWidth(desired, max)
    panel.style.width = `${width}px`
    handle.setAttribute('aria-valuemin', String(MIN_WIDTH))
    handle.setAttribute('aria-valuemax', String(max))
    handle.setAttribute('aria-valuenow', String(width))
    return width
  }

  function change(next: number): void {
    desired = clampWidth(next, getMaxWidth())
    apply()
  }

  handle.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return
    down.preventDefault()
    const startX = down.clientX
    const startWidth = apply()
    handle.setPointerCapture(down.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: PointerEvent): void => change(startWidth + (startX - e.clientX))
    // pointerup / pointercancel / キャプチャ喪失のどれで終わっても後片付けは1回だけ行う
    const onEnd = (): void => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)
      handle.removeEventListener('lostpointercapture', onEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onCommit(desired)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
    handle.addEventListener('lostpointercapture', onEnd)
  })

  handle.addEventListener('keydown', (e) => {
    const delta = e.key === 'ArrowLeft' ? KEY_STEP : e.key === 'ArrowRight' ? -KEY_STEP : 0
    if (delta === 0) return
    e.preventDefault()
    change(apply() + delta)
    onCommit(desired)
  })

  // ウィンドウや他パネルの幅が変わったとき、上限を超えたままにならないようにする
  window.addEventListener('resize', apply)
  apply()
}
