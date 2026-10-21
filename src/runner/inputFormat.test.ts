import { describe, it, expect } from 'vitest'
import { decideSubmit, formatTracePreview, tooLongMessage } from './inputFormat'

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

describe('decideSubmit', () => {
  const enter = { key: 'Enter', isComposing: false }

  it('Enter 以外のキーは無視する', () => {
    expect(decideSubmit({ key: 'a', isComposing: false }, 'abc', 10)).toEqual({ action: 'ignore' })
  })

  it('IME 変換中の Enter は無視する', () => {
    expect(decideSubmit({ key: 'Enter', isComposing: true }, 'あ', 10)).toEqual({ action: 'ignore' })
  })

  it('Enter で値とバイト列を送信する', () => {
    const d = decideSubmit(enter, 'ab', 10)
    expect(d.action).toBe('submit')
    expect(d.action === 'submit' && d.value).toBe('ab')
    expect(d.action === 'submit' && Array.from(d.bytes)).toEqual([97, 98])
  })

  it('空文字も送信できる', () => {
    expect(decideSubmit(enter, '', 10).action).toBe('submit')
  })

  it('上限超過はエラーを返し送信しない', () => {
    expect(decideSubmit(enter, 'あ', 2)).toEqual({ action: 'error', message: tooLongMessage(3, 2) })
  })
})
