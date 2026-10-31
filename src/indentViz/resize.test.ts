// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { attachResize, clampWidth, DEFAULT_WIDTH, loadWidth, MIN_WIDTH, saveWidth } from './resize'

describe('clampWidth', () => {
  it('下限・上限に収める', () => {
    expect(clampWidth(10, 1600)).toBe(MIN_WIDTH)
    expect(clampWidth(5000, 1600)).toBe(800)
  })

  it('ウィンドウ幅の6割を超えない', () => {
    expect(clampWidth(700, 1000)).toBe(600)
  })

  it('狭いウィンドウでも下限は守る', () => {
    expect(clampWidth(300, 200)).toBe(MIN_WIDTH)
  })

  it('数値でない値は既定幅', () => {
    expect(clampWidth(Number.NaN, 1600)).toBe(DEFAULT_WIDTH)
  })
})

describe('width storage', () => {
  it('保存した幅を復元し、壊れた値や例外では既定幅になる', () => {
    const store = new Map<string, string>()
    saveWidth({ setItem: (k, v) => void store.set(k, v) }, 400)
    expect(loadWidth({ getItem: k => store.get(k) ?? null })).toBe(400)
    expect(loadWidth({ getItem: () => null })).toBe(DEFAULT_WIDTH)
    expect(loadWidth({ getItem: () => { throw new Error('denied') } })).toBe(DEFAULT_WIDTH)
    expect(Number.isNaN(loadWidth({ getItem: () => 'abc' }))).toBe(true)
  })
})

describe('attachResize', () => {
  function setup(initialWidth: number) {
    window.innerWidth = 1600
    const panel = document.createElement('aside')
    const handle = document.createElement('div')
    const onCommit = vi.fn()
    attachResize({ panel, handle, initialWidth, onCommit })
    return { panel, handle, onCommit }
  }

  it('初期幅を適用する', () => {
    expect(setup(360).panel.style.width).toBe('360px')
  })

  it('壊れた初期値は既定幅になる', () => {
    expect(setup(Number.NaN).panel.style.width).toBe(`${DEFAULT_WIDTH}px`)
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
})
