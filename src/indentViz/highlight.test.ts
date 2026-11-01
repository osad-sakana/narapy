import { describe, expect, it } from 'vitest'
import { highlightStatement, type Segment } from './highlight'

const flat = (segments: readonly Segment[]): string => segments.map(s => s.text).join('')
const inputs = (segments: readonly Segment[]): string[] => segments.filter(s => s.cls === 'input').map(s => s.text)
const keywords = (segments: readonly Segment[]): string[] => segments.filter(s => s.cls === 'keyword').map(s => s.text)

describe('highlightStatement', () => {
  it('複合文は語と入力欄に分け、末尾のコロンは表示しない', () => {
    const [line] = highlightStatement('if x > 1:', 'if')
    expect(keywords(line)).toEqual(['if'])
    expect(inputs(line)).toEqual(['x > 1'])
    expect(flat(line)).toBe('if x > 1')
  })

  it('条件のない節（else / try / finally）は語だけになる', () => {
    expect(highlightStatement('else:', 'else')[0]).toEqual([{ text: 'else', cls: 'keyword' }])
    expect(inputs(highlightStatement('try:', 'try')[0])).toEqual([])
  })

  it('def / class / with / match も入力欄を持つ', () => {
    expect(inputs(highlightStatement('def f(a, b=1):', 'def')[0])).toEqual(['f(a, b=1)'])
    expect(keywords(highlightStatement('async def f():', 'def')[0])).toEqual(['async def'])
    expect(inputs(highlightStatement('class A(B):', 'class')[0])).toEqual(['A(B)'])
    expect(inputs(highlightStatement('with open(p) as f:', 'with')[0])).toEqual(['open(p) as f'])
    expect(inputs(highlightStatement('match cmd:', 'match')[0])).toEqual(['cmd'])
  })

  it('複数行の見出しは1つの入力欄に改行を保つ', () => {
    const [line] = highlightStatement('def f(\n  a,\n  b,\n):', 'def')
    expect(inputs(line)).toEqual(['f(\n  a,\n  b,\n)'])
  })

  it('for は変数と対象を別の入力欄にする', () => {
    const [line] = highlightStatement('for i, j in pairs:', 'for')
    expect(keywords(line)).toEqual(['for', 'in'])
    expect(inputs(line)).toEqual(['i, j', 'pairs'])
  })

  it('async for も扱う', () => {
    const [line] = highlightStatement('async for x in xs:', 'for')
    expect(keywords(line)).toEqual(['async for', 'in'])
  })

  it('代入は左辺と右辺を入力欄にし、= を語にする', () => {
    const [line] = highlightStatement('total = a + b', 'assignment')
    expect(inputs(line)).toEqual(['total', 'a + b'])
    expect(keywords(line)).toEqual(['='])
  })

  it('複数行の右辺は入力欄の中で改行を保つ', () => {
    const lines = highlightStatement('x = [\n  1,\n]', 'assignment')
    expect(lines).toHaveLength(1)
    expect(inputs(lines[0])).toEqual(['x', '[\n  1,\n]'])
  })

  it('解釈できない代入（注釈つきなど）は元の文字列のまま出す', () => {
    expect(flat(highlightStatement('y: int = 3', 'assignment')[0])).toBe('y: int = 3')
  })

  it('return / break / pass などの語を強調し、他の文はそのまま出す', () => {
    expect(keywords(highlightStatement('return a + b', 'other')[0])).toEqual(['return'])
    expect(keywords(highlightStatement('break', 'other')[0])).toEqual(['break'])
    expect(keywords(highlightStatement('print("hi")', 'other')[0])).toEqual([])
    expect(highlightStatement('print(\n  1,\n)', 'other')).toHaveLength(3)
  })

  it('import は名前を入力欄にする', () => {
    const [line] = highlightStatement('from a import b as c, d', 'import')
    expect(inputs(line)).toEqual(['c', 'd'])
    expect(keywords(line)).toEqual(['from', 'import'])
    expect(flat(line)).toContain('from a import')
    expect(inputs(highlightStatement('import numpy as np', 'import')[0])).toEqual(['np'])
  })

  it('日本語の変数名も扱える', () => {
    expect(inputs(highlightStatement('合計 = 1', 'assignment')[0])).toEqual(['合計', '1'])
    expect(inputs(highlightStatement('for 番号 in 一覧:', 'for')[0])).toEqual(['番号', '一覧'])
  })

  it('キーワードで始まる非ASCII識別子は語として扱わない', () => {
    expect(keywords(highlightStatement('if変数 = 1', 'if')[0])).toEqual([])
  })
})
