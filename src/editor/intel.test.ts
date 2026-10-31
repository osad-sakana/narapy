import { describe, expect, it } from 'vitest'
import {
  DOC_MAX_CHARS,
  hoverMarkdown,
  parseHoverInfo,
  parseSignatureInfo,
  signatureLabel,
} from './intel'

describe('parseHoverInfo', () => {
  it('正常な応答を受け取る', () => {
    expect(
      parseHoverInfo({ name: 'f', type: 'function', signature: 'f(a)', doc: 'hi', description: 'def f' }),
    ).toEqual({ name: 'f', type: 'function', signature: 'f(a)', doc: 'hi', description: 'def f' })
  })

  it('name が無い・非オブジェクトは null', () => {
    expect(parseHoverInfo(null)).toBeNull()
    expect(parseHoverInfo('x')).toBeNull()
    expect(parseHoverInfo({ type: 'function' })).toBeNull()
    expect(parseHoverInfo({ name: '' })).toBeNull()
  })

  it('非文字列のフィールドは空文字、doc は長さ制限', () => {
    const info = parseHoverInfo({ name: 'f', signature: 1, doc: 'd'.repeat(DOC_MAX_CHARS + 50) })
    expect(info?.signature).toBe('')
    expect(info?.type).toBe('')
    expect(info?.doc).toHaveLength(DOC_MAX_CHARS)
  })
})

describe('parseSignatureInfo', () => {
  it('正常な応答を受け取る', () => {
    expect(parseSignatureInfo({ name: 'f', params: ['a', 'b=1'], index: 1, doc: 'x' })).toEqual({
      name: 'f', params: ['a', 'b=1'], index: 1, doc: 'x',
    })
  })

  it('name が無ければ null、params 以外の要素は捨てる', () => {
    expect(parseSignatureInfo({ params: [] })).toBeNull()
    expect(parseSignatureInfo({ name: 'f', params: ['a', 1, null] })?.params).toEqual(['a'])
  })

  it('index は 0 以上の整数のみ、それ以外は -1', () => {
    const idx = [0, 2, -1, 1.5, '1', null].map(
      (index) => parseSignatureInfo({ name: 'f', params: [], index })?.index,
    )
    expect(idx).toEqual([0, 2, -1, -1, -1, -1])
  })
})

describe('hoverMarkdown', () => {
  it('シグネチャをコードブロック、docstring を本文にする', () => {
    const md = hoverMarkdown({ name: 'f', type: 'function', signature: 'f(a)', doc: '説明', description: '' })
    expect(md).toBe('```python\nf(a)\n```\n\n```text\n説明\n```')
  })

  it('シグネチャが無ければ description、どちらも無ければ name', () => {
    expect(hoverMarkdown({ name: 'x', type: 'statement', signature: '', doc: '', description: 'x = 1' }))
      .toBe('```python\nx = 1\n```')
    expect(hoverMarkdown({ name: 'x', type: '', signature: '', doc: '', description: '' }))
      .toBe('```python\nx\n```')
  })

  it('docstring 内のコードフェンスを無害化する', () => {
    const md = hoverMarkdown({ name: 'f', type: 'function', signature: '', doc: 'a ``` b', description: '' })
    expect(md).not.toContain('a ```')
  })
})

describe('signatureLabel', () => {
  it('引数ごとの範囲を label 内のオフセットで返す', () => {
    const { label, parameters } = signatureLabel({ name: 'f', params: ['a', 'b=1'], index: 0, doc: '' })
    expect(label).toBe('f(a, b=1)')
    expect(parameters).toEqual([[2, 3], [5, 8]])
    expect(label.slice(...parameters[1])).toBe('b=1')
  })

  it('引数なし', () => {
    expect(signatureLabel({ name: 'f', params: [], index: -1, doc: '' })).toEqual({ label: 'f()', parameters: [] })
  })
})
