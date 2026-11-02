import { describe, expect, it } from 'vitest'
import { buildMessage, parseLintResult, toLogLine } from './result'
import { toMarkers } from './markers'
import { decideLintApply } from './decide'

const warning = { name: 'print', kind: 'expr', line: 3, col: 5, endCol: 10 } as const

describe('parseLintResult', () => {
  it('正しい ok を受け取る', () => {
    expect(parseLintResult({ status: 'ok', warnings: [warning] })).toEqual({ status: 'ok', warnings: [warning] })
  })

  it.each([
    null,
    'ok',
    { status: 'ok' },
    { status: 'ok', warnings: [{ ...warning, kind: 'for' }] },
    { status: 'ok', warnings: [{ ...warning, line: 0 }] },
    { status: 'ok', warnings: [{ ...warning, col: 1.5 }] },
    { status: 'ok', warnings: [null] },
    { status: 'unknown' },
  ])('不正な形は null: %j', (value) => {
    expect(parseLintResult(value)).toBeNull()
  })

  it('syntax_error / failed を受け取る', () => {
    expect(parseLintResult({ status: 'syntax_error' })).toEqual({ status: 'syntax_error' })
    expect(parseLintResult({ status: 'failed' })).toEqual({ status: 'failed' })
  })
})

describe('メッセージ', () => {
  it('式文は () の付け方を説明する', () => {
    expect(buildMessage(warning)).toBe('「print」の後ろに「()」がありません。「print()」のように「()」をつけて呼び出します')
  })

  it('条件は常に真になることを説明する', () => {
    const msg = buildMessage({ ...warning, name: 'foo', kind: 'if' })
    expect(msg).toContain('条件が関数「foo」そのもの')
    expect(msg).toContain('常に真')
  })

  it('実行ログは行番号つきで、マーカーと同じ文言', () => {
    expect(toLogLine(warning)).toBe(`[警告] 3行目: ${buildMessage(warning)}`)
    expect(toMarkers([warning], 4)[0]?.message).toBe(buildMessage(warning))
  })
})

describe('toMarkers', () => {
  it('位置と severity を変換する', () => {
    expect(toMarkers([warning], 4)).toEqual([{
      severity: 4,
      message: buildMessage(warning),
      startLineNumber: 3,
      startColumn: 5,
      endLineNumber: 3,
      endColumn: 10,
    }])
  })
})

describe('decideLintApply', () => {
  const base = { sameModel: true, sentVersion: 1, currentVersion: 1, suppressed: false, isPython: true }

  it('条件が揃えば apply', () => {
    expect(decideLintApply(base)).toBe('apply')
  })

  it('モデルが違う・versionId が違う結果は stale', () => {
    expect(decideLintApply({ ...base, sameModel: false })).toBe('stale')
    expect(decideLintApply({ ...base, currentVersion: 2 })).toBe('stale')
  })

  it('講師モード・.py 以外は clear', () => {
    expect(decideLintApply({ ...base, suppressed: true })).toBe('clear')
    expect(decideLintApply({ ...base, isPython: false })).toBe('clear')
  })
})
