import { describe, expect, it } from 'vitest'
import { formatMessage, parseFormatResult } from './result'

describe('parseFormatResult', () => {
  it('ok を受け付ける', () => {
    expect(parseFormatResult({ status: 'ok', code: 'a = 1\n' })).toEqual({ status: 'ok', code: 'a = 1\n' })
  })

  it('syntax_error は行番号とメッセージを持つ', () => {
    expect(parseFormatResult({ status: 'syntax_error', line: 3, msg: 'invalid syntax' }))
      .toEqual({ status: 'syntax_error', line: 3, msg: 'invalid syntax' })
  })

  it('rejected を受け付ける', () => {
    expect(parseFormatResult({ status: 'rejected' })).toEqual({ status: 'rejected' })
  })

  it.each([
    null, 'x', 1, {}, { status: 'ok' }, { status: 'ok', code: 1 },
    { status: 'syntax_error', line: 'a', msg: 'x' }, { status: 'syntax_error', line: 1.5, msg: 'x' },
    { status: 'unknown' },
  ])('不正な値は null: %j', (v) => {
    expect(parseFormatResult(v)).toBeNull()
  })
})

describe('formatMessage', () => {
  it('構文エラーは行番号入り', () => {
    expect(formatMessage({ status: 'syntax_error', line: 3, msg: 'x' })).toContain('3行目')
  })

  it('結果ごとに文言がある', () => {
    for (const status of ['unchanged', 'rejected', 'unavailable', 'too_large', 'timeout'] as const) {
      expect(formatMessage({ status })).not.toBe('')
    }
  })

  it('ok は null（通知不要）', () => {
    expect(formatMessage({ status: 'ok', code: '' })).toBeNull()
  })
})
