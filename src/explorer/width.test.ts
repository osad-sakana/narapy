import { describe, it, expect } from 'vitest'
import {
  clampWidth,
  parseStoredWidth,
  EXPLORER_WIDTH_DEFAULT,
  EXPLORER_WIDTH_MIN,
  EXPLORER_WIDTH_MAX,
} from './width'

describe('clampWidth', () => {
  it('範囲内の値はそのまま（整数に丸める）', () => {
    expect(clampWidth(200)).toBe(200)
    expect(clampWidth(200.6)).toBe(201)
  })

  it('下限・上限に収める', () => {
    expect(clampWidth(10)).toBe(EXPLORER_WIDTH_MIN)
    expect(clampWidth(9999)).toBe(EXPLORER_WIDTH_MAX)
  })

  it('NaN や無限大は既定幅にする', () => {
    expect(clampWidth(Number.NaN)).toBe(EXPLORER_WIDTH_DEFAULT)
    expect(clampWidth(Number.POSITIVE_INFINITY)).toBe(EXPLORER_WIDTH_DEFAULT)
  })
})

describe('parseStoredWidth', () => {
  it('未保存(null)は既定幅', () => {
    expect(parseStoredWidth(null)).toBe(EXPLORER_WIDTH_DEFAULT)
  })

  it('数値文字列は範囲内に収めて返す', () => {
    expect(parseStoredWidth('260')).toBe(260)
    expect(parseStoredWidth('5000')).toBe(EXPLORER_WIDTH_MAX)
  })

  it('壊れた値は既定幅', () => {
    expect(parseStoredWidth('abc')).toBe(EXPLORER_WIDTH_DEFAULT)
    expect(parseStoredWidth('')).toBe(EXPLORER_WIDTH_DEFAULT)
  })
})
