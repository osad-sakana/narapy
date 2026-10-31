import { describe, expect, it } from 'vitest'
import { parseIndentTree, parseImportNames, type VizNode } from './parse'

function kinds(nodes: readonly VizNode[]): string[] {
  return nodes.map(n => (n.type === 'group' ? `group(${n.statements.map(s => s.kind).join(',')})` : `block:${n.kind}`))
}

describe('parseIndentTree', () => {
  it('インデントで入れ子にする', () => {
    const tree = parseIndentTree('for i in range(3):\n    if i:\n        print(i)')
    expect(tree).toHaveLength(1)
    const loop = tree[0]
    if (loop.type !== 'block') throw new Error('block expected')
    expect(loop.kind).toBe('flow')
    expect(loop.header).toBe('for i in range(3):')
    const inner = loop.children[0]
    if (inner.type !== 'block') throw new Error('block expected')
    expect(inner.header).toBe('if i:')
    expect(inner.children).toHaveLength(1)
  })

  it('連続する単純文は1つのグループにまとまり、空行で分かれる', () => {
    const tree = parseIndentTree('a = 1\nb = 2\n\nc = 3')
    expect(tree).toHaveLength(2)
    expect(tree[0].type === 'group' && tree[0].statements).toHaveLength(2)
    expect(tree[1].type === 'group' && tree[1].statements).toHaveLength(1)
  })

  it('ブロックの前後で単純文のグループが分かれる', () => {
    const tree = parseIndentTree('a = 1\nif a:\n    pass\nb = 2')
    expect(kinds(tree)).toEqual(['group(flow)', 'block:flow', 'group(flow)'])
  })

  it('種類ごとの色分類', () => {
    const src = [
      'import os', 'x = 1', 'print(x)', 'pass', 'raise ValueError', 'assert x',
      'return 1', 'break', 'continue',
    ].join('\n')
    const [group] = parseIndentTree(src)
    if (group.type !== 'group') throw new Error('group expected')
    expect(group.statements.map(s => s.kind)).toEqual([
      'import', 'flow', 'plain', 'purple', 'purple', 'purple', 'def', 'flow', 'flow',
    ])
  })

  it('def / class / try / with / match の色分類', () => {
    const src = [
      'def f():', '    pass',
      'class C:', '    def m(self):', '        pass',
      'try:', '    pass', 'except E:', '    pass', 'finally:', '    pass',
      'with open(p) as f:', '    pass',
      'match v:', '    case 1:', '        pass',
    ].join('\n')
    expect(kinds(parseIndentTree(src))).toEqual([
      'block:def', 'block:class', 'block:try', 'block:try', 'block:try', 'block:with', 'block:class',
    ])
  })

  it('class 直下の def は method になる', () => {
    const [cls] = parseIndentTree('class C:\n    def m(self):\n        pass\n    x = 1')
    if (cls.type !== 'block') throw new Error('block expected')
    expect(kinds(cls.children)).toEqual(['block:method', 'group(flow)'])
  })

  it('メソッド内の入れ子の def は method にならない', () => {
    const [cls] = parseIndentTree('class C:\n    def m(self):\n        def inner():\n            pass')
    if (cls.type !== 'block') throw new Error('block expected')
    const m = cls.children[0]
    if (m.type !== 'block') throw new Error('block expected')
    expect(kinds(m.children)).toEqual(['block:def'])
  })

  it('elif / else は別ブロックとして兄弟になる', () => {
    const tree = parseIndentTree('if a:\n    pass\nelif b:\n    pass\nelse:\n    pass')
    expect(tree.map(n => n.type === 'block' && n.header)).toEqual(['if a:', 'elif b:', 'else:'])
  })

  it('デコレータは直後の def と同じブロックにまとまる', () => {
    const tree = parseIndentTree('@a\n@b(1)\ndef f():\n    pass')
    expect(tree).toHaveLength(1)
    const block = tree[0]
    if (block.type !== 'block') throw new Error('block expected')
    expect(block.decorators).toEqual(['@a', '@b(1)'])
    expect(block.header).toBe('def f():')
  })

  it('async def / async for / async with を認識する', () => {
    expect(kinds(parseIndentTree('async def f():\n    pass'))).toEqual(['block:def'])
    expect(kinds(parseIndentTree('async for x in y:\n    pass'))).toEqual(['block:flow'])
    expect(kinds(parseIndentTree('async with a as b:\n    pass'))).toEqual(['block:with'])
  })

  it('1行に書かれた if も block として扱う', () => {
    expect(kinds(parseIndentTree('if x: y = 1'))).toEqual(['block:flow'])
  })

  it('match / case はコロン終端のときだけ構文として扱う', () => {
    expect(kinds(parseIndentTree('match = 1\nmatch(x)'))).toEqual(['group(flow,plain)'])
  })

  it('キーワード引数の = は代入にしない', () => {
    const [g] = parseIndentTree('foo(a=1)\nx += 1\nd["k"] = 2\ny: int = 3\na == b')
    if (g.type !== 'group') throw new Error('group expected')
    expect(g.statements.map(s => s.kind)).toEqual(['plain', 'flow', 'flow', 'flow', 'plain'])
  })

  it('複数行の文は1文として扱い、先頭行番号を持つ', () => {
    const [g] = parseIndentTree('x = [\n    1,\n    2,\n]\ny = 1')
    if (g.type !== 'group') throw new Error('group expected')
    expect(g.statements).toHaveLength(2)
    expect(g.statements[0].line).toBe(1)
    expect(g.statements[1].line).toBe(5)
  })

  it('インデントが不規則でも落ちない', () => {
    expect(() => parseIndentTree('  a = 1\nb = 2\n      c = 3\n  d = 4')).not.toThrow()
  })

  it('空入力は空配列', () => {
    expect(parseIndentTree('')).toEqual([])
    expect(parseIndentTree('# only comment\n\n')).toEqual([])
  })
})

describe('parseImportNames', () => {
  it('import の名前を返す', () => {
    expect(parseImportNames('import os, sys')).toEqual(['os', 'sys'])
  })
  it('as の別名を優先する', () => {
    expect(parseImportNames('import numpy as np')).toEqual(['np'])
    expect(parseImportNames('from a import b as c, d')).toEqual(['c', 'd'])
  })
  it('括弧付き from import', () => {
    expect(parseImportNames('from a import ( b, c as d, )')).toEqual(['b', 'd'])
  })
  it('ドット付きモジュールと *', () => {
    expect(parseImportNames('import os.path')).toEqual(['os.path'])
    expect(parseImportNames('from a import *')).toEqual(['*'])
  })
  it('import 以外は空', () => {
    expect(parseImportNames('x = 1')).toEqual([])
  })
})
