import { describe, expect, it } from 'vitest'
import { computeMinimalEdit } from './minimalEdit'

describe('computeMinimalEdit', () => {
  it('同一なら null', () => {
    expect(computeMinimalEdit('a = 1\n', 'a = 1\n')).toBeNull()
  })

  it('中ほどだけの差分を返す', () => {
    expect(computeMinimalEdit('x=1\n', 'x = 1\n')).toEqual({ start: 1, end: 2, text: ' = ' })
  })

  it('挿入のみ', () => {
    expect(computeMinimalEdit('ab', 'aXb')).toEqual({ start: 1, end: 1, text: 'X' })
  })

  it('削除のみ', () => {
    expect(computeMinimalEdit('aXb', 'ab')).toEqual({ start: 1, end: 2, text: '' })
  })

  it('接頭辞と接尾辞が重なる繰り返しでも範囲が破綻しない', () => {
    expect(computeMinimalEdit('aa', 'aaa')).toEqual({ start: 2, end: 2, text: 'a' })
  })

  it('空文字列から', () => {
    expect(computeMinimalEdit('', 'x')).toEqual({ start: 0, end: 0, text: 'x' })
  })

  it('適用すると after に一致する', () => {
    const before = 'def f( a,b ):\n  return a+b\n'
    const after = 'def f(a, b):\n    return a + b\n'
    const e = computeMinimalEdit(before, after)!
    expect(before.slice(0, e.start) + e.text + before.slice(e.end)).toBe(after)
  })
})
