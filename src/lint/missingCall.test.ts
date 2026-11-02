import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadPyodide, type PyodideInterface } from 'pyodide'

// 本番と同じ Pyodide(CPython 3.12) で Python 側の検出ロジックを検証する。
// skip すると受け入れ条件（検出ロジックの単体テスト）が検証されなくなるため、起動に失敗したら落とす。
let py: PyodideInterface

beforeAll(async () => {
  py = await loadPyodide()
  py.runPython(readFileSync(new URL('./missingCall.py', import.meta.url), 'utf-8'))
}, 60_000)

interface Warning { name: string; kind: string; line: number; col: number; endCol: number }
interface Result { status: string; warnings?: Warning[] }

function detect(source: string): Result {
  const fn = py.globals.get('_narapy_missing_call')
  try {
    return JSON.parse(fn(source) as string) as Result
  } finally {
    fn.destroy()
  }
}

function names(source: string): string[] {
  return (detect(source).warnings ?? []).map(w => `${w.kind}:${w.name}`)
}

describe('警告するケース', () => {
  it('単独の組み込み関数名', () => {
    const r = detect('print')
    expect(r.status).toBe('ok')
    expect(r.warnings).toEqual([{ name: 'print', kind: 'expr', line: 1, col: 1, endCol: 6 }])
  })

  it('同ファイルで def した関数の単独呼び出し', () => {
    expect(names('def foo():\n    pass\nfoo\n')).toEqual(['expr:foo'])
  })

  it('if / elif / while / assert の条件が関数名そのもの', () => {
    const src = 'def foo():\n    pass\nif foo:\n    pass\nelif foo:\n    pass\nwhile foo:\n    break\nassert foo\n'
    expect(names(src)).toEqual(['if:foo', 'if:foo', 'while:foo', 'assert:foo'])
  })

  it('関数やクラスの中も検査する', () => {
    expect(names('def f():\n    print\n')).toEqual(['expr:print'])
  })

  it('async def も関数として扱う', () => {
    expect(names('async def foo():\n    pass\nfoo\n')).toEqual(['expr:foo'])
  })

  it('日本語の識別子でも文字単位の列を返す', () => {
    const r = detect('def 表示():\n    pass\n  \n表示\n')
    expect(r.warnings).toEqual([{ name: '表示', kind: 'expr', line: 4, col: 1, endCol: 3 }])
    const indented = detect('def 表示():\n    pass\nif True:\n    表示\n')
    expect(indented.warnings?.[0]).toMatchObject({ line: 4, col: 5, endCol: 7 })
  })

  it('同じ行の前に絵文字があっても UTF-16 単位の列を返す', () => {
    const r = detect('def 表示():\n    pass\nx = "😀"; 表示\n')
    expect(r.warnings?.[0]).toMatchObject({ line: 3, col: 11, endCol: 13 })
  })

  it('CRLF の改行でも行番号が合う', () => {
    expect(detect('print\r\nprint\r\n').warnings?.map(w => w.line)).toEqual([1, 2])
  })
})

describe('警告しないケース', () => {
  it.each([
    ['呼び出している', 'print()'],
    ['代入の右辺', 'def foo():\n    pass\nx = foo'],
    ['return', 'def foo():\n    pass\ndef g():\n    return foo'],
    ['引数のコールバック', 'def foo():\n    pass\nlist(map(foo, [1]))'],
    ['比較', 'def foo():\n    pass\nif foo == 1:\n    pass'],
    ['not', 'def foo():\n    pass\nif not foo:\n    pass'],
    ['import した関数', 'from os import getcwd\ngetcwd'],
    ['import as', 'import os as o\no'],
    ['組み込み名を再代入', 'print = 5\nprint'],
    ['def と代入が共存', 'def foo():\n    pass\nfoo = 1\nfoo'],
    ['関数の引数に同名', 'def f(print):\n    print\n'],
    ['クラス（組み込み）', 'int'],
    ['クラス（list）', 'list'],
    ['未定義の名前', 'undefined_name'],
    ['star import', 'from math import *\nprint'],
    ['属性アクセス', 'import os\nos.getcwd'],
    ['for のターゲット', 'for print in []:\n    pass\nprint'],
    ['global 宣言', 'def foo():\n    pass\ndef g():\n    global foo\n    foo = 1\nfoo'],
  ])('%s', (_label, src) => {
    expect(detect(src)).toEqual({ status: 'ok', warnings: [] })
  })
})

describe('異常系', () => {
  it('構文エラーは syntax_error を返し例外を出さない', () => {
    expect(detect('if foo\n  print').status).toBe('syntax_error')
  })

  it('空文字は ok で警告なし', () => {
    expect(detect('')).toEqual({ status: 'ok', warnings: [] })
  })

  it('NUL 文字を含んでも例外を出さない', () => {
    expect(detect('print\0').status).toBe('syntax_error')
  })

  it('極端に深い入れ子でも例外を出さない', () => {
    const r = detect('x = ' + '['.repeat(5000) + ']'.repeat(5000))
    expect(['ok', 'syntax_error', 'failed']).toContain(r.status)
  })
})
