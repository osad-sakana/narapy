import { describe, it, expect } from 'vitest'
import {
  detectReservedWordMisuse,
  extractErrorSourceLine,
  findMisusedReservedWord,
  stripStringsAndComments,
} from './reservedWord'

describe('stripStringsAndComments', () => {
  it('文字列リテラルの中身を空白に置き換え、長さを保つ', () => {
    const src = 'print("class = 1")'
    const out = stripStringsAndComments(src)
    expect(out).toHaveLength(src.length)
    expect(out).not.toContain('class')
    expect(out.startsWith('print(')).toBe(true)
  })

  it('# 以降のコメントを消す', () => {
    expect(stripStringsAndComments('x = 1  # class = 2').includes('class')).toBe(false)
  })

  it('文字列内の # はコメント扱いしない', () => {
    expect(stripStringsAndComments('x = "#"; class = 1')).toContain('class')
  })

  it('エスケープされた引用符では文字列を閉じない', () => {
    expect(stripStringsAndComments('s = "a\\" def for"; z = 1')).not.toContain('def')
    expect(stripStringsAndComments('s = "a\\" def for"; z = 1')).toContain('z = 1')
  })

  it('シングルクォートと三重引用符（1行内）も除去する', () => {
    expect(stripStringsAndComments("s = 'def for'")).not.toContain('def')
    expect(stripStringsAndComments('s = """def for"""')).not.toContain('def')
  })

  it('閉じていない文字列は行末まで除去する', () => {
    expect(stripStringsAndComments('s = "class = 1')).not.toContain('class')
  })
})

describe('extractErrorSourceLine', () => {
  it('最後の <exec> フレームの直後の1行を返す', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 2',
      '    class = 1',
      '          ^',
      'SyntaxError: invalid syntax',
    ].join('\n')
    expect(extractErrorSourceLine(raw)).toBe('class = 1')
  })

  it('format_exception_only 形式（Traceback ヘッダなし）でも取れる', () => {
    const raw = ['  File "<exec>", line 1', '    for = 3', '       ^', 'SyntaxError: invalid syntax'].join('\n')
    expect(extractErrorSourceLine(raw)).toBe('for = 3')
  })

  it('Pyodide 内部フレームのソース行は拾わない', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 573, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 1',
      '    class = 1',
      '          ^',
      'SyntaxError: invalid syntax',
    ].join('\n')
    expect(extractErrorSourceLine(raw)).toBe('class = 1')
  })

  it('<exec> フレームの後にソース行がなければ null', () => {
    const raw = ['Traceback (most recent call last):', '  File "<exec>", line 3, in <module>', 'SyntaxError: invalid syntax'].join('\n')
    expect(extractErrorSourceLine(raw)).toBeNull()
  })

  it('直後がキャレット行だけなら null', () => {
    const raw = ['  File "<exec>", line 1', '    ^', 'SyntaxError: invalid syntax'].join('\n')
    expect(extractErrorSourceLine(raw)).toBeNull()
  })

  it('<exec> フレームが無ければ null', () => {
    expect(extractErrorSourceLine('SyntaxError: invalid syntax')).toBeNull()
  })
})

describe('detectReservedWordMisuse（検出する）', () => {
  const cases: Array<[string, string]> = [
    ['class = 1', 'class'],
    ['for=3', 'for'],
    ['class += 1', 'class'],
    ['class //= 2', 'class'],
    ['obj.class = 1', 'class'],
    ['x = 1; class = 2', 'class'],
    ['    if = 5', 'if'],
    ['def for():', 'for'],
    ['class if:', 'if'],
    ['def None():', 'None'],
    ['for class in range(3):', 'class'],
    ['import class', 'class'],
    ['import os, class', 'class'],
    ['with open(p) as class:', 'class'],
    ['except ValueError as class:', 'class'],
    ['def f(class):', 'class'],
    ['def f(a, class):', 'class'],
    ['def f(a, class=1):', 'class'],
    ['def f(a, *class):', 'class'],
    ['def f(True):', 'True'],
    ['f = lambda class: 1', 'class'],
    ['f(class=1)', 'class'],
  ]
  it.each(cases)('%s → %s', (line, kw) => {
    expect(detectReservedWordMisuse(stripStringsAndComments(line))).toBe(kw)
  })
})

describe('detectReservedWordMisuse（検出しない）', () => {
  const cases: string[] = [
    'print("class = 1")',
    'x = 1  # class = 2',
    "s = 'def for'",
    's = """def for"""',
    'if x == None:',
    'if a <= b:',
    'if x >= 1:',
    'if x != None:',
    'class_ = 1',
    'my_class = 1',
    '合計for = 1',
    'for_ = 1',
    'match = 1',
    'case = 1',
    'type = 1',
    '_ = 1',
    'print(x',
    'for i in range(3):',
    'def f(a, b=None):',
    'import os as o',
    'f = lambda x: None',
    // 演算子として使う予約語の直後の = は「名前に使った」ではない
    'if x not = 1:',
    'if x is = 1:',
    'if a > 0 and = 1:',
    'x = a if b else = 2',
    'if x == True = 1:',
    'while x is not None = 1:',
    // 型注釈は合法
    'x: None = 5 5',
    // 1行で書いた関数の本体は引数リストではない
    'def f(x): print(x, True) y',
    'def f(x): return f(x, None) + 1 2',
  ]
  it.each(cases)('%s', (line) => {
    expect(detectReservedWordMisuse(stripStringsAndComments(line))).toBeNull()
  })
})

describe('extractErrorSourceLine（SyntaxError が出た行だけを返す）', () => {
  it('exec() 内の SyntaxError など、<exec> の後に別フレームが続くなら null', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 2, in run',
      '    exec("1 2", None)',
      '  File "<string>", line 1',
      '    1 2',
      '      ^',
      'SyntaxError: invalid syntax',
    ].join('\n')
    expect(extractErrorSourceLine(raw)).toBeNull()
  })
})

describe('findMisusedReservedWord', () => {
  it('トレースバックから予約語の誤用を見つける', () => {
    const raw = ['  File "<exec>", line 1', '    class = 1', '          ^', 'SyntaxError: invalid syntax'].join('\n')
    expect(findMisusedReservedWord(raw)).toBe('class')
  })

  it('ソース行が無ければ null', () => {
    expect(findMisusedReservedWord('SyntaxError: invalid syntax')).toBeNull()
  })

  it('Pyodide 内部フレームの await だけでは検出しない', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 573, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 1',
      '    print(x',
      '         ^',
      'SyntaxError: invalid syntax',
    ].join('\n')
    expect(findMisusedReservedWord(raw)).toBeNull()
  })
})
