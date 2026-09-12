import { describe, expect, it } from 'vitest'
import { parseTraceResult } from './parse'

describe('parseTraceResult', () => {
  it('正常なJSONをパースできる', () => {
    const json = JSON.stringify({
      steps: [
        { line: 1, event: 'line', funcName: '<module>', depth: 0, locals: [], globals: null },
        {
          line: 2,
          event: 'return',
          funcName: 'add',
          depth: 1,
          locals: [{ name: 'a', type: 'int', value: '1' }],
          globals: [{ name: 'x', type: 'int', value: '1' }],
        },
      ],
      truncated: false,
      error: null,
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.steps).toHaveLength(2)
      expect(result.result.truncated).toBe(false)
      expect(result.result.error).toBeNull()
    }
  })

  it('errorフィールドが文字列の場合も保持する', () => {
    const json = JSON.stringify({ steps: [], truncated: true, error: 'ZeroDivisionError: division by zero' })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.error).toBe('ZeroDivisionError: division by zero')
      expect(result.result.truncated).toBe(true)
    }
  })

  it('steps が空でも正常にパースできる', () => {
    const result = parseTraceResult(JSON.stringify({ steps: [], truncated: false, error: null }))
    expect(result.ok).toBe(true)
  })

  it('不正なJSON文字列はエラーになる', () => {
    const result = parseTraceResult('{invalid json')
    expect(result.ok).toBe(false)
  })

  it('steps が配列でない場合はエラーになる', () => {
    const result = parseTraceResult(JSON.stringify({ steps: 'not-an-array', truncated: false, error: null }))
    expect(result.ok).toBe(false)
  })

  it('ステップの必須フィールドが欠けている場合はエラーになる', () => {
    const json = JSON.stringify({
      steps: [{ line: 1, event: 'line', funcName: '<module>' /* depth, locals 欠落 */ }],
      truncated: false,
      error: null,
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(false)
  })

  it('event が不正な値の場合はエラーになる', () => {
    const json = JSON.stringify({
      steps: [{ line: 1, event: 'invalid', funcName: '<module>', depth: 0, locals: [], globals: null }],
      truncated: false,
      error: null,
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(false)
  })

  it('truncated が boolean でない場合はエラーになる', () => {
    const result = parseTraceResult(JSON.stringify({ steps: [], truncated: 'yes', error: null }))
    expect(result.ok).toBe(false)
  })

  it('トップレベルが配列の場合はエラーになる', () => {
    const result = parseTraceResult(JSON.stringify([1, 2, 3]))
    expect(result.ok).toBe(false)
  })
})
