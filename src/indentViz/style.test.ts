import { describe, expect, it } from 'vitest'
import { contrastRatio, fillOf, INK_COLOR, TYPE_COLORS } from './style'

describe('fillOf', () => {
  it('元の色を白に寄せる（白は白のまま、黒は 45% 白に寄る）', () => {
    expect(fillOf('#ffffff')).toBe('#ffffff')
    expect(fillOf('#000000')).toBe('#737373')
  })

  it('常に元の色より明るい（元の色が白でない限り）', () => {
    for (const color of Object.values(TYPE_COLORS)) {
      expect(contrastRatio(fillOf(color), '#ffffff')).toBeLessThan(contrastRatio(color, '#ffffff'))
    }
  })
})

describe('ブロックの文字色', () => {
  it('実際に表示される塗りの上で、すべてのブロック色が WCAG AA（4.5）以上', () => {
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      expect(contrastRatio(fillOf(color), INK_COLOR), type).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('contrastRatio', () => {
  it('白と黒は 21、同色は 1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })
})
