import { describe, expect, it } from 'vitest'
import { inkOn, TYPE_COLORS, TYPE_INK } from './style'

function ratio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const n = Number.parseInt(hex.slice(1), 16)
    const c = (v: number): number => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255)
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('inkOn', () => {
  it('明るい塗りには濃い文字、暗い塗りには白を選ぶ', () => {
    expect(inkOn('#ffffff')).toBe('#1b1b29')
    expect(inkOn('#000000')).toBe('#ffffff')
  })
})

describe('TYPE_INK', () => {
  it('すべてのブロック色で、選んだ文字色は反対の文字色よりコントラストが高い', () => {
    for (const [type, fill] of Object.entries(TYPE_COLORS)) {
      const ink = TYPE_INK[type as keyof typeof TYPE_INK]
      const other = ink === '#ffffff' ? '#1b1b29' : '#ffffff'
      expect(ratio(fill, ink)).toBeGreaterThanOrEqual(ratio(fill, other))
    }
  })

  it('どのブロック色でも文字が実用的に読める（コントラスト比 3 以上）', () => {
    for (const [type, fill] of Object.entries(TYPE_COLORS)) {
      expect(ratio(fill, TYPE_INK[type as keyof typeof TYPE_INK]), type).toBeGreaterThanOrEqual(3)
    }
  })
})
