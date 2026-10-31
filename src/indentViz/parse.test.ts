import { describe, expect, it } from 'vitest'
import { parseImportNames, parseIndentTree, type VizNode } from './parse'

function types(nodes: readonly VizNode[]): string[] {
  return nodes.map(n => n.type)
}

describe('parseIndentTree', () => {
  it('インデントで入れ子にする', () => {
    const [loop] = parseIndentTree('for i in range(3):\n    if i:\n        print(i)')
    expect(loop.type).toBe('for')
    expect(loop.text).toBe('for i in range(3):')
    expect(types(loop.children)).toEqual(['if'])
    expect(types(loop.children[0].children)).toEqual(['other'])
  })

  it('単純文は1文ごとに1ノードになる', () => {
    const tree = parseIndentTree('a = 1\nb = 2\n\nc = 3')
    expect(types(tree)).toEqual(['assignment', 'assignment', 'assignment'])
  })

  it('文の種類を分類する', () => {
    const src = ['import os', 'from a import b', 'x = 1', 'print(x)', 'pass', 'return 1'].join('\n')
    expect(types(parseIndentTree(src))).toEqual(['import', 'import', 'assignment', 'other', 'other', 'other'])
  })

  it('複合文を分類する', () => {
    const src = [
      'def f():', '    pass',
      'class C:', '    pass',
      'try:', '    pass', 'except E:', '    pass', 'finally:', '    pass',
      'with open(p) as f:', '    pass',
      'match v:', '    case 1:', '        pass',
    ].join('\n')
    const tree = parseIndentTree(src)
    expect(types(tree)).toEqual(['def', 'class', 'try', 'except', 'finally', 'with', 'match'])
    expect(types(tree[6].children)).toEqual(['case'])
  })

  it('class の内側の def は method になる', () => {
    const [cls] = parseIndentTree('class C:\n    def m(self):\n        pass\n    x = 1')
    expect(types(cls.children)).toEqual(['method', 'assignment'])
  })

  it('class の外の def は method にならない', () => {
    expect(types(parseIndentTree('def f():\n    def g():\n        pass'))).toEqual(['def'])
    expect(types(parseIndentTree('def f():\n    def g():\n        pass')[0].children)).toEqual(['def'])
  })

  it('elif / else は兄弟ノードになる', () => {
    const tree = parseIndentTree('if a:\n    pass\nelif b:\n    pass\nelse:\n    pass')
    expect(types(tree)).toEqual(['if', 'elif', 'else'])
  })

  it('デコレータは直後の def / class に付く', () => {
    const [fn] = parseIndentTree('@a\n@b(1)\ndef f():\n    pass')
    expect(fn.decorators).toEqual(['@a', '@b(1)'])
    expect(fn.text).toBe('def f():')
  })

  it('def / class 以外の前のデコレータは消さずに単純文として出し、次の文に持ち越さない', () => {
    const tree = parseIndentTree('@a\nx = 1\ndef f():\n    pass')
    expect(tree.map(n => [n.type, n.text, n.decorators.length])).toEqual([
      ['other', '@a', 0], ['assignment', 'x = 1', 0], ['def', 'def f():', 0],
    ])
  })

  it('スコープ末尾に残ったデコレータも消さない', () => {
    const [fn] = parseIndentTree('def f():\n    pass\n    @a')
    expect(fn.children.map(n => n.text)).toEqual(['pass', '@a'])
  })

  it('空白が極端に長い行でも一瞬で終わる', () => {
    const started = Date.now()
    parseIndentTree('a' + ' '.repeat(50000) + 'b')
    expect(Date.now() - started).toBeLessThan(500)
  })

  it('行数の多い連続文・巨大リテラルでも現実的な時間で終わる', () => {
    const started = Date.now()
    parseIndentTree('x = [\n' + '    1,\n'.repeat(20000) + ']')
    parseIndentTree('a = 1\n'.repeat(20000))
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('閉じていない括弧があっても、後続のブロックは構造として見える', () => {
    const tree = parseIndentTree('print(\nif x:\n    y = 1\nz = 2')
    expect(tree.map(n => n.type)).toEqual(['other', 'if', 'assignment'])
    expect(tree[1].children.map(n => n.text)).toEqual(['y = 1'])
  })

  it('async def / async for / async with を認識する', () => {
    expect(types(parseIndentTree('async def f():\n    pass'))).toEqual(['def'])
    expect(types(parseIndentTree('async for x in y:\n    pass'))).toEqual(['for'])
    expect(types(parseIndentTree('async with a as b:\n    pass'))).toEqual(['with'])
  })

  it('1行に書かれた if も if として扱う', () => {
    expect(types(parseIndentTree('if x: y = 1'))).toEqual(['if'])
  })

  it('match / case はコロン終端のときだけ構文として扱う', () => {
    expect(types(parseIndentTree('match = 1\nmatch(x)'))).toEqual(['assignment', 'other'])
  })

  it('キーワード引数・比較の = は代入にしない', () => {
    const src = 'foo(a=1)\nx += 1\nd["k"] = 2\ny: int = 3\na == b'
    expect(types(parseIndentTree(src))).toEqual(['other', 'assignment', 'assignment', 'assignment', 'other'])
  })

  it('文字列の中の = で代入と誤判定しない', () => {
    const src = ['return "a=b"', 'assert x, "k=v"', 'del d["a=b"]', "return 'key=' + v", 'd["k=1"] = 2'].join('\n')
    expect(types(parseIndentTree(src))).toEqual(['other', 'other', 'other', 'other', 'assignment'])
  })

  it('日本語の変数名でも代入・for・複合文を判定できる', () => {
    expect(types(parseIndentTree('合計 = 0\nfor 番号 in 一覧:\n    pass\n合計: int = 1'))).toEqual(['assignment', 'for', 'assignment'])
  })

  it('キーワードで始まる非ASCII識別子を複合文にしない', () => {
    expect(types(parseIndentTree('for合計 = 1\nif変数 = 2'))).toEqual(['assignment', 'assignment'])
  })

  it('デコレータ付きの def / class はデコレータの行から数える', () => {
    const tree = parseIndentTree('x = 1\n@a\n@b\ndef f():\n    pass')
    expect(tree.map(n => n.line)).toEqual([1, 2])
  })

  it('複数行の文は1ノードで、先頭行番号と改行を保つ', () => {
    const tree = parseIndentTree('x = [\n    1,\n    2,\n]\ny = 1')
    expect(tree).toHaveLength(2)
    expect(tree[0].line).toBe(1)
    expect(tree[0].text).toBe('x = [\n  1,\n  2,\n]')
    expect(tree[1].line).toBe(5)
  })

  it('インデントが不規則でも落ちない', () => {
    expect(() => parseIndentTree('  a = 1\nb = 2\n      c = 3\n  d = 4')).not.toThrow()
  })

  it('単純文の後ろに深いインデントが続いても全行を消費して終わる', () => {
    expect(types(parseIndentTree('a = 1\n    b = 2\nc = 3'))).toEqual(['assignment', 'assignment', 'assignment'])
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
  it('括弧付き・複数行の from import', () => {
    expect(parseIndentTreeNames('from a import (\n    b,\n    c as d,\n)')).toEqual(['b', 'd'])
  })
  it('ドット付きモジュールと *', () => {
    expect(parseImportNames('import os.path')).toEqual(['os.path'])
    expect(parseImportNames('from a import *')).toEqual(['*'])
  })
  it('import 以外は空', () => {
    expect(parseImportNames('x = 1')).toEqual([])
  })
})

function parseIndentTreeNames(src: string): string[] {
  const [node] = parseIndentTree(src)
  return parseImportNames(node.text)
}
