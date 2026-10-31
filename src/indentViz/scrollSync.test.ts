import { describe, expect, it } from 'vitest'
import { findBlockIndex } from './scrollSync'

describe('findBlockIndex', () => {
  const lines = [1, 4, 4, 9, 20]

  it('上端の行を含む（line <= top の最後の）ブロックを返す', () => {
    expect(findBlockIndex(lines, 4)).toBe(2)
    expect(findBlockIndex(lines, 15)).toBe(3)
    expect(findBlockIndex(lines, 999)).toBe(4)
  })

  it('長い文の途中が上端でも次の文へ飛ばない', () => {
    expect(findBlockIndex([1, 50], 30)).toBe(0)
  })

  it('先頭より前なら先頭を返す', () => {
    expect(findBlockIndex([5, 10], 1)).toBe(0)
  })

  it('空なら -1', () => {
    expect(findBlockIndex([], 3)).toBe(-1)
  })
})
