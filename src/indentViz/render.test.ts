// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseIndentTree } from './parse'
import { renderTree } from './render'

describe('renderTree', () => {
  it('入れ子のブロックを入れ子のDOMにし、行番号を持たせる', () => {
    const root = renderTree(parseIndentTree('def f():\n    if x:\n        y = 1'))
    const blocks = root.querySelectorAll<HTMLElement>('[data-line]')
    expect([...blocks].map(b => [b.dataset.statement, b.dataset.line])).toEqual([
      ['def', '1'], ['if', '2'], ['assignment', '3'],
    ])
    expect(root.firstElementChild?.querySelectorAll('[data-line]')).toHaveLength(2)
  })

  it('アイコン付きラベルを出す（other は出さない）', () => {
    const root = renderTree(parseIndentTree('if a:\n    print(1)'))
    expect(root.textContent).toContain('🔀 もし')
    const other = root.querySelector('[data-statement="other"]')
    expect(other?.querySelector('span.rounded-md')).toBeNull()
  })

  it('import 名をバッジで表示する', () => {
    const root = renderTree(parseIndentTree('import numpy as np'))
    expect([...root.querySelectorAll('span.inline-block')].map(b => b.textContent)).toEqual(['np'])
  })

  it('コード中のHTMLはタグとして解釈しない', () => {
    const root = renderTree(parseIndentTree('x = "<img src=x onerror=alert(1)>"\n<b>y</b>'))
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('b')).toBeNull()
    expect(root.textContent).toContain('<img')
  })

  it('デコレータを定義の上に含める', () => {
    const root = renderTree(parseIndentTree('@deco\ndef f():\n    pass'))
    expect(root.firstElementChild?.querySelector('.font-mono')?.textContent).toBe('@deco\ndef f():')
  })
})
