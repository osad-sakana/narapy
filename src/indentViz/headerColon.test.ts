import { describe, expect, it } from 'vitest'
import { findHeaderColon } from './headerColon'

const split = (text: string): [string, string] | null => {
  const i = findHeaderColon(text)
  return i === -1 ? null : [text.slice(0, i + 1), text.slice(i + 1).trim()]
}

describe('findHeaderColon', () => {
  it('末尾のコロンを見つける', () => {
    expect(split('if x > 1:')).toEqual(['if x > 1:', ''])
    expect(split('else:')).toEqual(['else:', ''])
  })

  it('1行に書かれた本体を分ける', () => {
    expect(split('if x: y = 1')).toEqual(['if x:', 'y = 1'])
    expect(split('else: pass')).toEqual(['else:', 'pass'])
    expect(split('try: f()')).toEqual(['try:', 'f()'])
    expect(split('class A: pass')).toEqual(['class A:', 'pass'])
    expect(split('for i in x: print(i)')).toEqual(['for i in x:', 'print(i)'])
  })

  it('本体の中のコロンには反応しない（最初のコロンだけ）', () => {
    expect(split('if x: d = {1: 2}')).toEqual(['if x:', 'd = {1: 2}'])
  })

  it('括弧・添字・文字列の中のコロンは飛ばす', () => {
    expect(split('if x[1:2]: pass')).toEqual(['if x[1:2]:', 'pass'])
    expect(split('if d == {"a": 1}: pass')).toEqual(['if d == {"a": 1}:', 'pass'])
    expect(split('if s == "a:b": pass')).toEqual(['if s == "a:b":', 'pass'])
    expect(split("if s == 'it\\'s: x': pass")).toEqual(["if s == 'it\\'s: x':", 'pass'])
    expect(split('def f(a: int, b: str = "x") -> int: return 1')).toEqual(['def f(a: int, b: str = "x") -> int:', 'return 1'])
  })

  it('代入式 := と lambda のコロンは見出しの終わりではない', () => {
    expect(split('while chunk := f.read(): pass')).toEqual(['while chunk := f.read():', 'pass'])
    expect(split('if (lambda: 1)(): pass')).toEqual(['if (lambda: 1)():', 'pass'])
    expect(split('if f(lambda x: x): pass')).toEqual(['if f(lambda x: x):', 'pass'])
    expect(split('x = lambda: 1')).toBeNull()
  })

  it('lambda を含む識別子では lambda 扱いしない', () => {
    expect(split('if my_lambda: pass')).toEqual(['if my_lambda:', 'pass'])
  })

  it('複数行の見出しでも最後のコロンを見つける', () => {
    expect(split('def f(\n  a,\n  b,\n):')).toEqual(['def f(\n  a,\n  b,\n):', ''])
  })

  it('三連引用符の中のコロンは飛ばす', () => {
    expect(split('if s == """a:b""": pass')).toEqual(['if s == """a:b""":', 'pass'])
  })

  it('コロンがなければ -1', () => {
    expect(findHeaderColon('if x')).toBe(-1)
    expect(findHeaderColon('')).toBe(-1)
  })
})
