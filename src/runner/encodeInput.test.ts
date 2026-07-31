import { describe, it, expect } from 'vitest'
import { encodeInputValue } from './encodeInput'

describe('encodeInputValue', () => {
  it('キャンセル（null）は ok: false を返す', () => {
    expect(encodeInputValue(null, 10)).toEqual({ ok: false })
  })

  it('空文字は ok: true, 長さ0のバイト列を返す', () => {
    const result = encodeInputValue('', 10)
    expect(result.ok).toBe(true)
    expect(result.ok && result.bytes.length).toBe(0)
  })

  it('上限以内の入力は ok: true でエンコードされたバイト列を返す', () => {
    const result = encodeInputValue('hello', 10)
    expect(result.ok).toBe(true)
    expect(result.ok && Array.from(result.bytes)).toEqual([104, 101, 108, 108, 111])
  })

  it('上限バイト数ちょうどの入力は ok: true になる', () => {
    const result = encodeInputValue('abc', 3)
    expect(result.ok).toBe(true)
  })

  it('上限を超える入力は ok: false になる', () => {
    const result = encodeInputValue('x'.repeat(5000), 4092)
    expect(result).toEqual({ ok: false })
  })

  it('マルチバイト文字はUTF-8バイト数で上限判定される', () => {
    // "あ" は UTF-8 で3バイト
    const result = encodeInputValue('あ', 2)
    expect(result).toEqual({ ok: false })
  })
})
