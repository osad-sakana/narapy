// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseIndentTree } from './parse'
import { renderTree } from './render'

const render = (source: string): HTMLElement => renderTree(parseIndentTree(source))
const roleTexts = (root: Element, role: string): (string | null)[] =>
  [...root.querySelectorAll(`[data-role="${role}"]`)].map(el => el.textContent)

describe('renderTree', () => {
  it('入れ子の文を、行番号と種類を持つ要素の入れ子にする', () => {
    const root = render('def f():\n    if x:\n        y = 1')
    const blocks = root.querySelectorAll<HTMLElement>('[data-line]')
    expect([...blocks].map(b => [b.dataset.statement, b.dataset.line])).toEqual([
      ['def', '1'], ['if', '2'], ['assignment', '3'],
    ])
  })

  it('複合文は C 字型ブロック（見出し腕・口・下の腕）で、子は口の中に入る', () => {
    const root = render('for i in x:\n    y = 1')
    const c = root.querySelector('.viz-c')
    expect(c?.querySelector(':scope > .viz-c-head')?.textContent).toContain('for')
    expect(c?.querySelector(':scope > .viz-c-foot')).not.toBeNull()
    const mouth = c?.querySelector('[data-role="mouth"]')
    expect(mouth?.querySelectorAll('.viz-block')).toHaveLength(1)
    expect(mouth?.querySelector('[data-statement="assignment"]')).not.toBeNull()
  })

  it('子のない複合文も空の口を持つ', () => {
    const mouth = render('if x: y = 1').querySelector('[data-role="mouth"]')
    expect(mouth).not.toBeNull()
    expect(mouth?.querySelector('.viz-block')).toBeNull()
  })

  it('単純文は C 字型にならず、口も下の腕も持たない', () => {
    const root = render('x = 1\nprint(x)')
    expect(root.querySelectorAll('.viz-block')).toHaveLength(2)
    expect(root.querySelector('.viz-c')).toBeNull()
    expect(root.querySelector('[data-role="mouth"]')).toBeNull()
  })

  it('if / elif / else は1つの C 字型ブロックにまとまり、節ごとに行番号を持つ', () => {
    const root = render('if a:\n    x = 1\nelif b:\n    x = 2\nelse:\n    x = 3')
    expect(root.querySelectorAll('.viz-c')).toHaveLength(1)
    expect(root.querySelectorAll('.viz-c-foot')).toHaveLength(1)
    const heads = [...root.querySelectorAll<HTMLElement>('.viz-c-head')]
    expect(heads.map(h => [h.dataset.statement, h.dataset.line])).toEqual([['if', '1'], ['elif', '3'], ['else', '5']])
    expect(root.querySelectorAll('[data-role="mouth"]')).toHaveLength(3)
  })

  it('連なった節の色は先頭の文の色になる', () => {
    const root = render('for i in x:\n    pass\nelse:\n    pass')
    const c = root.querySelector<HTMLElement>('.viz-c')
    expect(c?.style.getPropertyValue('--viz-color')).toBe('#ffab19')
    expect(root.querySelectorAll('.viz-c')).toHaveLength(1)
  })

  it('文書内の data-line は昇順に並ぶ（スクロール同期の前提）', () => {
    const root = render('def f():\n    if a:\n        x = 1\n    else:\n        x = 2\ny = 3')
    const lines = [...root.querySelectorAll<HTMLElement>('[data-line]')].map(el => Number(el.dataset.line))
    expect(lines).toEqual([...lines].sort((a, b) => a - b))
  })

  it('ブロックごとに塗りの色と文字色を持つ', () => {
    const block = render('x = 1').querySelector<HTMLElement>('.viz-block')
    expect(block?.style.getPropertyValue('--viz-color')).toMatch(/^#/)
    expect(block?.style.getPropertyValue('--viz-ink')).toMatch(/^#/)
  })

  it('ラベル（アイコン付き）を出す。other には出さない', () => {
    const root = render('if a:\n    print(1)')
    expect(roleTexts(root, 'label')).toEqual(['もし'])
    expect(root.querySelector('[data-statement="other"] [data-role="label"]')).toBeNull()
  })

  it('条件・式・名前は入力欄（白い楕円）になる', () => {
    expect(roleTexts(render('if x > 1:\n    pass'), 'input')).toEqual(['x > 1'])
    expect(roleTexts(render('total = a + b'), 'input')).toEqual(['total', 'a + b'])
    expect(roleTexts(render('import numpy as np'), 'input')).toEqual(['np'])
  })

  it('改行を含む式の入力欄は角丸の箱にする', () => {
    const input = render('x = [\n  1,\n]').querySelectorAll('[data-role="input"]')[1]
    expect(input.classList.contains('viz-input-multiline')).toBe(true)
  })

  it('コード中のHTMLはタグとして解釈しない', () => {
    const root = render('x = "<img src=x onerror=alert(1)>"\n<b>y</b>')
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('b')).toBeNull()
    expect(root.textContent).toContain('<img')
  })

  it('デコレータを定義の見出しに含める', () => {
    const code = render('@deco\ndef f():\n    pass').querySelector('.viz-c-head [data-role="code"]')
    expect(code?.textContent).toBe('@deco\ndef f()')
  })

  it('ハットブロックは付けない（先頭は積み木か C 字型ブロックのみ）', () => {
    const stack = render('x = 1\nif a:\n    pass')
    expect([...stack.children].map(c => c.className)).toEqual(['viz-block', 'viz-c'])
  })
})
