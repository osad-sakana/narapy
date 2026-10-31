import { describe, expect, it } from 'vitest'
import {
  DOC_MAX_CHARS,
  describeSignature,
  hoverMarkdown,
  parseHoverInfo,
  parseSignatureHelp,
  parseSignatureInfo,
  signatureDocMarkdown,
  signatureLabel,
} from './intel'

describe('parseHoverInfo', () => {
  it('正常な応答を受け取る', () => {
    expect(
      parseHoverInfo({ name: 'f', fullName: 'm.f', type: 'function', signature: 'f(a)', doc: 'hi', description: 'def f' }),
    ).toEqual({ name: 'f', fullName: 'm.f', type: 'function', signature: 'f(a)', doc: 'hi', description: 'def f' })
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
    expect(parseSignatureInfo({ name: 'f', fullName: 'm.f', params: ['a', 'b=1'], index: 1, doc: 'x' })).toEqual({
      name: 'f', fullName: 'm.f', params: ['a', 'b=1'], index: 1, doc: 'x',
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
    const md = hoverMarkdown({ name: 'f', fullName: '', type: 'function', signature: 'f(a)', doc: '説明', description: '' })
    expect(md).toBe('```python\nf(a)\n```\n\n```text\n説明\n```')
  })

  it('シグネチャが無ければ description、どちらも無ければ name', () => {
    expect(hoverMarkdown({ name: 'x', fullName: '', type: 'statement', signature: '', doc: '', description: 'x = 1' }))
      .toBe('```python\nx = 1\n```')
    expect(hoverMarkdown({ name: 'x', fullName: '', type: '', signature: '', doc: '', description: '' }))
      .toBe('```python\nx\n```')
  })

  it('docstring 内のコードフェンスを無害化する', () => {
    const md = hoverMarkdown({ name: 'f', fullName: '', type: 'function', signature: '', doc: 'a ``` b', description: '' })
    expect(md).not.toContain('a ```')
  })
})

describe('signatureLabel', () => {
  it('引数ごとの範囲を label 内のオフセットで返す', () => {
    const { label, parameters } = signatureLabel({ name: 'f', fullName: '', params: ['a', 'b=1'], index: 0, doc: '' })
    expect(label).toBe('f(a, b=1)')
    expect(parameters).toEqual([[2, 3], [5, 8]])
    expect(label.slice(...parameters[1])).toBe('b=1')
  })

  it('引数なし', () => {
    expect(signatureLabel({ name: 'f', fullName: '', params: [], index: -1, doc: '' })).toEqual({ label: 'f()', parameters: [] })
  })
})

describe('parseSignatureHelp', () => {
  const sig = (index: number) => ({ name: 'range', fullName: 'builtins.range', params: ['a'], index, doc: '' })

  it('複数のオーバーロードと active を受け取る', () => {
    const help = parseSignatureHelp({ active: 1, signatures: [sig(-1), sig(1)] })
    expect(help?.signatures).toHaveLength(2)
    expect(help?.active).toBe(1)
  })

  it('active が範囲外・非整数なら 0', () => {
    expect(parseSignatureHelp({ active: 5, signatures: [sig(0)] })?.active).toBe(0)
    expect(parseSignatureHelp({ active: -1, signatures: [sig(0)] })?.active).toBe(0)
    expect(parseSignatureHelp({ active: '1', signatures: [sig(0)] })?.active).toBe(0)
  })

  it('不正な要素は捨て、1件も残らなければ null、件数は 5 件まで', () => {
    expect(parseSignatureHelp({ signatures: [null, 1] })).toBeNull()
    expect(parseSignatureHelp({ signatures: 'x' })).toBeNull()
    expect(parseSignatureHelp(null)).toBeNull()
    expect(parseSignatureHelp({ signatures: Array.from({ length: 9 }, () => sig(0)) })?.signatures).toHaveLength(5)
  })
})

describe('signatureDocMarkdown', () => {
  it('空なら undefined、あれば text フェンスで囲みフェンスを無害化する', () => {
    expect(signatureDocMarkdown('')).toBeUndefined()
    expect(signatureDocMarkdown('a')).toBe('```text\na\n```')
    expect(signatureDocMarkdown('x ``` y')).not.toContain('x ```')
  })
})

describe('日本語辞書の反映', () => {
  const printSig = {
    name: 'print',
    fullName: 'builtins.print',
    params: ['*values: object', 'sep: Optional[str]=...'],
    index: 1,
    doc: 'print(value, ...)',
  }

  it('引数ヘルプ: 要約が先頭、引数ごとの説明が付き、英語の docstring が後に続く', () => {
    const view = describeSignature(printSig)
    expect(view.parameters[0].documentation).toContain('表示する値')
    expect(view.parameters[1].documentation).toContain('間に入れる文字')
    expect(view.documentation?.startsWith('値を画面')).toBe(true)
    expect(view.documentation).toContain('print(value, ...)')
  })

  it('引数ヘルプ: 辞書にない関数は従来どおり（引数説明なし、docstring のみ）', () => {
    const view = describeSignature({ name: 'f', fullName: 'mine.f', params: ['a'], index: 0, doc: 'hello' })
    expect(view.parameters).toEqual([{ range: [2, 3], documentation: undefined }])
    expect(view.documentation).toBe('```text\nhello\n```')
  })

  it('hover: シグネチャ → 日本語の要約と引数 → 英語の docstring の順', () => {
    const md = hoverMarkdown({
      name: 'randint', fullName: 'random.randint', type: 'function',
      signature: 'randint(a: int, b: int) -> int', doc: 'Return random integer', description: '',
    })
    const order = ['randint(a: int', 'a 以上 b 以下', '- `a`: 最小値', 'Return random integer'].map((t) => md.indexOf(t))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
  })

  it('hover: 辞書にない関数は日本語部分を出さない', () => {
    const md = hoverMarkdown({ name: 'f', fullName: 'mine.f', type: 'function', signature: 'f()', doc: '', description: '' })
    expect(md).toBe('```python\nf()\n```')
  })
})
