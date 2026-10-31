// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachResize, availableWidth, clampWidth, DEFAULT_WIDTH, loadWidth, MIN_WIDTH, saveWidth } from './resize'

describe('clampWidth', () => {
  it('下限と上限に収める', () => {
    expect(clampWidth(10, 700)).toBe(MIN_WIDTH)
    expect(clampWidth(5000, 700)).toBe(700)
    expect(clampWidth(5000, 5000)).toBe(800)
  })

  it('上限が下限より小さくても下限は守る', () => {
    expect(clampWidth(300, 50)).toBe(MIN_WIDTH)
  })

  it('数値でない値は既定幅として扱う', () => {
    expect(clampWidth(Number.NaN, 1000)).toBe(DEFAULT_WIDTH)
  })
})

describe('width storage', () => {
  it('保存した幅を復元し、保存なし・例外では既定幅になる', () => {
    const store = new Map<string, string>()
    saveWidth({ setItem: (k, v) => void store.set(k, v) }, 400)
    expect(loadWidth({ getItem: k => store.get(k) ?? null })).toBe(400)
    expect(loadWidth({ getItem: () => null })).toBe(DEFAULT_WIDTH)
    expect(loadWidth({ getItem: () => { throw new Error('denied') } })).toBe(DEFAULT_WIDTH)
    expect(() => saveWidth({ setItem: () => { throw new Error('denied') } }, 1)).not.toThrow()
  })
})

function sized(el: HTMLElement, props: { offsetWidth?: number; clientWidth?: number }): HTMLElement {
  for (const [key, value] of Object.entries(props)) Object.defineProperty(el, key, { value, configurable: true })
  return el
}

describe('availableWidth', () => {
  it('固定幅の兄弟とエディタ最小幅を差し引き、flex-1 のエディタ列は数えない', () => {
    const row = sized(document.createElement('section'), { clientWidth: 1400 })
    const explorer = sized(document.createElement('aside'), { offsetWidth: 176 })
    const editor = sized(document.createElement('div'), { offsetWidth: 700 })
    editor.className = 'flex-1'
    const step = sized(document.createElement('aside'), { offsetWidth: 320 })
    const panel = document.createElement('aside')
    row.append(explorer, editor, step, panel)
    expect(availableWidth(panel)).toBe(1400 - 176 - 320 - 320)
  })

  it('閉じている兄弟（幅0）は差し引かない', () => {
    const row = sized(document.createElement('section'), { clientWidth: 1000 })
    const hiddenStep = sized(document.createElement('aside'), { offsetWidth: 0 })
    const panel = document.createElement('aside')
    row.append(hiddenStep, panel)
    expect(availableWidth(panel)).toBe(1000 - 320)
  })
})

describe('attachResize', () => {
  afterEach(() => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  function setup(initialWidth: number, maxWidth = 800) {
    const panel = document.createElement('aside')
    const handle = document.createElement('div')
    handle.setPointerCapture = vi.fn()
    const onCommit = vi.fn()
    const max = { value: maxWidth }
    attachResize({ panel, handle, initialWidth, getMaxWidth: () => max.value, onCommit })
    return { panel, handle, onCommit, max }
  }

  const pointer = (type: string, init: { clientX?: number; button?: number } = {}): PointerEvent =>
    new PointerEvent(type, { pointerId: 1, button: 0, clientX: 0, bubbles: true, cancelable: true, ...init })

  it('初期幅とARIA値を適用する', () => {
    const { panel, handle } = setup(360, 700)
    expect(panel.style.width).toBe('360px')
    expect(handle.getAttribute('aria-valuenow')).toBe('360')
    expect(handle.getAttribute('aria-valuemin')).toBe(String(MIN_WIDTH))
    expect(handle.getAttribute('aria-valuemax')).toBe('700')
  })

  it('壊れた初期値は既定幅になる', () => {
    expect(setup(Number.NaN).panel.style.width).toBe(`${DEFAULT_WIDTH}px`)
  })

  it('左へドラッグすると広がり、離したときに1回だけ確定を通知する', () => {
    const { panel, handle, onCommit } = setup(320)
    handle.dispatchEvent(pointer('pointerdown', { clientX: 500 }))
    expect(document.body.style.cursor).toBe('col-resize')
    handle.dispatchEvent(pointer('pointermove', { clientX: 420 }))
    expect(panel.style.width).toBe('400px')
    handle.dispatchEvent(pointer('pointerup', { clientX: 420 }))
    handle.dispatchEvent(pointer('lostpointercapture'))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(400)
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('ドラッグ中も上限・下限を超えない', () => {
    const { panel, handle } = setup(320, 500)
    handle.dispatchEvent(pointer('pointerdown', { clientX: 500 }))
    handle.dispatchEvent(pointer('pointermove', { clientX: -2000 }))
    expect(panel.style.width).toBe('500px')
    handle.dispatchEvent(pointer('pointermove', { clientX: 5000 }))
    expect(panel.style.width).toBe(`${MIN_WIDTH}px`)
  })

  it('左ボタン以外ではドラッグを始めない', () => {
    const { handle, onCommit } = setup(320)
    handle.dispatchEvent(pointer('pointerdown', { button: 2 }))
    handle.dispatchEvent(pointer('pointerup'))
    expect(document.body.style.cursor).toBe('')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('キャプチャが失われても後片付けされる', () => {
    const { handle, onCommit } = setup(320)
    handle.dispatchEvent(pointer('pointerdown'))
    handle.dispatchEvent(pointer('lostpointercapture'))
    expect(document.body.style.userSelect).toBe('')
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('キーボードの左右キーで幅を変え、確定を通知する', () => {
    const { panel, handle, onCommit } = setup(320)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(panel.style.width).toBe('336px')
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(panel.style.width).toBe('320px')
    expect(onCommit).toHaveBeenLastCalledWith(320)
  })

  it('関係ないキーでは何もしない', () => {
    const { handle, onCommit } = setup(320)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('上限が縮んだら詰め、広がったら希望幅へ戻る', () => {
    const { panel, max } = setup(600, 800)
    max.value = 400
    window.dispatchEvent(new Event('resize'))
    expect(panel.style.width).toBe('400px')
    max.value = 800
    window.dispatchEvent(new Event('resize'))
    expect(panel.style.width).toBe('600px')
  })

  it('起動時の上限が狭くても、希望幅は保存値のまま持ち、広がれば戻る', () => {
    const { panel, max } = setup(600, 300)
    expect(panel.style.width).toBe('300px')
    max.value = 800
    window.dispatchEvent(new Event('resize'))
    expect(panel.style.width).toBe('600px')
  })
})

describe('attachResize の兄弟パネル監視', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('エディタ列の幅が変わったら上限をかけ直す（自パネルは監視しない）', () => {
    const observed: Element[] = []
    let notify: () => void = () => {}
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { notify = cb }
      observe(el: Element): void { observed.push(el) }
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 1 })

    const row = document.createElement('section')
    const explorer = document.createElement('aside')
    const editor = document.createElement('div')
    editor.className = 'flex-1'
    const panel = document.createElement('aside')
    row.append(explorer, editor, panel)
    const handle = document.createElement('div')
    const max = { value: 800 }
    attachResize({ panel, handle, initialWidth: 600, getMaxWidth: () => max.value, onCommit: vi.fn() })

    expect(observed).toEqual([editor])
    max.value = 350
    notify()
    expect(panel.style.width).toBe('350px')
  })
})
