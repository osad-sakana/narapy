import { describe, expect, it } from 'vitest'
import { highlightStatement } from './highlight'

const flat = (segments: readonly { text: string }[]): string => segments.map(s => s.text).join('')

describe('highlightStatement', () => {
  it('元の文字列を欠落なく復元できる', () => {
    const cases: [string, Parameters<typeof highlightStatement>[1]][] = [
      ['if x > 1:', 'if'],
      ['for i in range(3):', 'for'],
      ['async def f(a):', 'def'],
      ['x, y = 1, 2', 'assignment'],
      ['return a + b', 'other'],
      ['print("hi")', 'other'],
    ]
    for (const [text, type] of cases) {
      expect(highlightStatement(text, type).map(flat).join('\n')).toBe(text)
    }
  })

  it('for のループ変数をバッジにする', () => {
    const [line] = highlightStatement('for i, j in pairs:', 'for')
    expect(line.find(s => s.cls === 'loopvar')?.text).toBe('i, j')
  })

  it('代入の左辺と = を分ける', () => {
    const [line] = highlightStatement('total = a + b', 'assignment')
    expect(line.find(s => s.cls === 'var')?.text).toBe('total')
    expect(line.find(s => s.cls === 'arrow')?.text).toBe('=')
  })

  it('キーワードの色は種類ごとに決まる', () => {
    const tone = (text: string): string | undefined =>
      highlightStatement(text, 'other')[0].find(s => s.cls === 'keyword')?.tone
    expect(tone('return 1')).toBe('def')
    expect(tone('break')).toBe('for')
    expect(tone('raise E')).toBe('other')
    expect(tone('print(1)')).toBeUndefined()
  })

  it('import は名前をバッジにする', () => {
    const [line] = highlightStatement('from a import b as c, d', 'import')
    expect(line.filter(s => s.cls === 'badge').map(s => s.text)).toEqual(['c', 'd'])
    expect(flat(line)).toContain('from a import')
  })

  it('複数行の文は行数を保つ', () => {
    expect(highlightStatement('x = [\n  1,\n]', 'assignment')).toHaveLength(3)
  })

  it('日本語の変数名もハイライトできる', () => {
    const [assign] = highlightStatement('合計 = 1', 'assignment')
    expect(assign.find(x => x.cls === 'var')?.text).toBe('合計')
    const [loop] = highlightStatement('for 番号 in 一覧:', 'for')
    expect(loop.find(x => x.cls === 'loopvar')?.text).toBe('番号')
  })
})
