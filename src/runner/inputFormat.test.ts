import { describe, it, expect } from 'vitest'
import { formatTracePreview, tooLongMessage } from './inputFormat'

describe('formatTracePreview', () => {
  it('空文字は null（表示するものなし）を返す', () => {
    expect(formatTracePreview('')).toBeNull()
  })

  it('改行だけの出力は null を返す', () => {
    expect(formatTracePreview('\n\n')).toBeNull()
  })

  it('末尾の改行を取り除く', () => {
    expect(formatTracePreview('1: りんご\n2: みかん\n')).toBe('1: りんご\n2: みかん')
  })

  it('途中の改行は保持する', () => {
    expect(formatTracePreview('a\n\nb')).toBe('a\n\nb')
  })
})

describe('tooLongMessage', () => {
  it('現在のバイト数と上限を含める', () => {
    expect(tooLongMessage(5000, 4092)).toBe('入力が長すぎます（5000バイト / 上限4092バイト）')
  })
})
