import { describe, expect, it } from 'vitest'
import { parseTraceResult } from './parse'

describe('parseTraceResult', () => {
  it('正常なJSONをパースできる', () => {
    const json = JSON.stringify({
      steps: [
        { line: 1, event: 'line', funcName: '<module>', depth: 0, locals: [], globals: null, stdout: '' },
        {
          line: 2,
          event: 'return',
          funcName: 'add',
          depth: 1,
          locals: [{ name: 'a', type: 'int', value: '1' }],
          globals: [{ name: 'x', type: 'int', value: '1' }],
          stdout: '1\n',
        },
      ],
      truncated: false,
      error: null,
      trailingStdout: '',
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.steps).toHaveLength(2)
      expect(result.result.steps[1].stdout).toBe('1\n')
      expect(result.result.truncated).toBe(false)
      expect(result.result.error).toBeNull()
      expect(result.result.trailingStdout).toBe('')
    }
  })

  it('errorフィールドが文字列の場合も保持する', () => {
    const json = JSON.stringify({
      steps: [], truncated: true, error: 'ZeroDivisionError: division by zero', trailingStdout: '',
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.error).toBe('ZeroDivisionError: division by zero')
      expect(result.result.truncated).toBe(true)
    }
  })

  it('trailingStdoutを保持する（打ち切り後の出力）', () => {
    const json = JSON.stringify({ steps: [], truncated: true, error: null, trailingStdout: '打ち切り後の出力' })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.trailingStdout).toBe('打ち切り後の出力')
    }
  })

  it('steps が空でも正常にパースできる', () => {
    const result = parseTraceResult(JSON.stringify({ steps: [], truncated: false, error: null, trailingStdout: '' }))
    expect(result.ok).toBe(true)
  })

  it('不正なJSON文字列はエラーになる', () => {
    const result = parseTraceResult('{invalid json')
    expect(result.ok).toBe(false)
  })

  it('steps が配列でない場合はエラーになる', () => {
    const result = parseTraceResult(
      JSON.stringify({ steps: 'not-an-array', truncated: false, error: null, trailingStdout: '' }),
    )
    expect(result.ok).toBe(false)
  })

  it('ステップの必須フィールドが欠けている場合はエラーになる', () => {
    const json = JSON.stringify({
      steps: [{ line: 1, event: 'line', funcName: '<module>' /* depth, locals, stdout 欠落 */ }],
      truncated: false,
      error: null,
      trailingStdout: '',
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(false)
  })

  it('ステップの stdout フィールドが欠けている場合はエラーになる', () => {
    const json = JSON.stringify({
      steps: [{ line: 1, event: 'line', funcName: '<module>', depth: 0, locals: [], globals: null }],
      truncated: false,
      error: null,
      trailingStdout: '',
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(false)
  })

  it('event が不正な値の場合はエラーになる', () => {
    const json = JSON.stringify({
      steps: [{ line: 1, event: 'invalid', funcName: '<module>', depth: 0, locals: [], globals: null, stdout: '' }],
      truncated: false,
      error: null,
      trailingStdout: '',
    })
    const result = parseTraceResult(json)
    expect(result.ok).toBe(false)
  })

  it('truncated が boolean でない場合はエラーになる', () => {
    const result = parseTraceResult(
      JSON.stringify({ steps: [], truncated: 'yes', error: null, trailingStdout: '' }),
    )
    expect(result.ok).toBe(false)
  })

  it('trailingStdout が文字列でない場合はエラーになる', () => {
    const result = parseTraceResult(
      JSON.stringify({ steps: [], truncated: false, error: null, trailingStdout: null }),
    )
    expect(result.ok).toBe(false)
  })

  it('トップレベルが配列の場合はエラーになる', () => {
    const result = parseTraceResult(JSON.stringify([1, 2, 3]))
    expect(result.ok).toBe(false)
  })
})
