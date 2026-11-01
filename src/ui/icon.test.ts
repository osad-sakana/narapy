// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createIcon, setIconLabel } from './icon'

describe('createIcon', () => {
  it('fa-solid クラスを持ち、スクリーンリーダーからは隠す', () => {
    const icon = createIcon('check')
    expect(icon.className).toBe('fa-solid fa-check')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('setIconLabel', () => {
  it('アイコンとテキストに置き換える', () => {
    const el = document.createElement('button')
    el.textContent = 'old'
    setIconLabel(el, 'wand-magic-sparkles', '整形')
    expect(el.querySelector('i.fa-wand-magic-sparkles')).not.toBeNull()
    expect(el.textContent).toBe('整形')
  })

  it('テキスト省略時はアイコンのみ', () => {
    const el = document.createElement('button')
    setIconLabel(el, 'play')
    expect(el.children).toHaveLength(1)
    expect(el.textContent).toBe('')
  })

  it('テキストはHTMLとして解釈しない', () => {
    const el = document.createElement('span')
    setIconLabel(el, 'check', '<b>x</b>')
    expect(el.querySelector('b')).toBeNull()
  })
})
