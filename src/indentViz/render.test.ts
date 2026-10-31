// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseIndentTree } from './parse'
import { renderTree } from './render'

describe('renderTree', () => {
  it('入れ子のブロックを入れ子のDOMにする', () => {
    const root = renderTree(parseIndentTree('def f():\n    if x:\n        y = 1'))
    const block = root.firstElementChild as HTMLElement
    expect(block.firstElementChild?.textContent).toBe('def f():')
    expect(block.textContent).toContain('if x:')
    expect(block.textContent).toContain('y = 1')
  })

  it('import 名をバッジで表示する', () => {
    const root = renderTree(parseIndentTree('import numpy as np'))
    const badges = root.querySelectorAll('span.rounded-full')
    expect([...badges].map(b => b.textContent)).toEqual(['np'])
  })

  it('コード中のHTMLはタグとして解釈しない', () => {
    const root = renderTree(parseIndentTree('x = "<img src=x onerror=alert(1)>"'))
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('<img')
  })

  it('デコレータをヘッダーに含める', () => {
    const root = renderTree(parseIndentTree('@deco\ndef f():\n    pass'))
    expect(root.firstElementChild?.firstElementChild?.textContent).toBe('@deco\ndef f():')
  })
})
