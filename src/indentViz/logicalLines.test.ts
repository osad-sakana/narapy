import { describe, expect, it } from 'vitest'
import { splitLogicalLines } from './logicalLines'

describe('splitLogicalLines', () => {
  it('インデント幅と行番号を保持する', () => {
    const lines = splitLogicalLines('if x:\n    y = 1')
    expect(lines).toEqual([
      { indent: 0, text: 'if x:', line: 1 },
      { indent: 4, text: 'y = 1', line: 2 },
    ])
  })

  it('タブは4スペースとして数える', () => {
    const [, second] = splitLogicalLines('if x:\n\ty = 1')
    expect(second.indent).toBe(4)
  })

  it('コメント行と行末コメントを除く', () => {
    const lines = splitLogicalLines('# top\na = 1  # note\n')
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('a = 1')
  })

  it('文字列内の # はコメントとして扱わない', () => {
    const [l] = splitLogicalLines('s = "a # b"')
    expect(l.text).toBe('s = "a # b"')
  })

  it('括弧をまたぐ複数行を1つの論理行にまとめる', () => {
    const lines = splitLogicalLines('foo(\n    1,\n    2,\n)\nbar = 1')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ text: 'foo(\n  1,\n  2,\n)', line: 1, indent: 0 })
    expect(lines[1].line).toBe(5)
  })

  it('括弧内のコメントや括弧文字を含む文字列で深さが狂わない', () => {
    const lines = splitLogicalLines('x = [  # (\n    ")",\n]\ny = 1')
    expect(lines).toHaveLength(2)
    expect(lines[1].text).toBe('y = 1')
  })

  it('バックスラッシュ継続を1つの論理行にまとめる', () => {
    const lines = splitLogicalLines('a = 1 + \\\n    2\nb = 3')
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('a = 1 +\n  2')
  })

  it('三連引用符をまたぐ文字列を1つの論理行にまとめる', () => {
    const lines = splitLogicalLines('s = """a\n\n  b"""\nz = 1')
    expect(lines).toHaveLength(2)
    expect(lines[1].text).toBe('z = 1')
  })

  it('docstring は除外する', () => {
    const lines = splitLogicalLines('def f():\n    """説明\n    続き"""\n    return 1')
    expect(lines.map(l => l.text)).toEqual(['def f():', 'return 1'])
  })

  it('単独の文字列リテラル文も除外する', () => {
    expect(splitLogicalLines("'doc'\nx = 1").map(l => l.text)).toEqual(['x = 1'])
  })

  it('CRLF を扱える', () => {
    expect(splitLogicalLines('a = 1\r\nb = 2').map(l => l.text)).toEqual(['a = 1', 'b = 2'])
  })

  it('閉じ括弧のない入力でも終了し、残りを落とさない', () => {
    expect(splitLogicalLines('foo(\n1').map(l => l.text)).toEqual(['foo(\n1'])
  })

  it('閉じていない括弧は、文の開始以下のインデントのブロック見出しで打ち切る', () => {
    const lines = splitLogicalLines('print(\nif x:\n    y = 1\nz = 2')
    expect(lines.map(l => l.text)).toEqual(['print(', 'if x:', 'y = 1', 'z = 2'])
  })

  it('未閉括弧の直後の match も打ち切りに使う', () => {
    expect(splitLogicalLines('foo(\nmatch x:\n    case 1:').map(l => l.text)).toEqual(['foo(', 'match x:', 'case 1:'])
  })

  it('括弧内のより深いインデントの行は打ち切りに使わない', () => {
    const lines = splitLogicalLines('foo(\n    if_x,\n    else_y:\n)')
    expect(lines).toHaveLength(1)
  })

  it('三連引用符を連結した式文は消さない', () => {
    expect(splitLogicalLines('"""a""" + """b"""')).toHaveLength(1)
  })

  it('三連引用符内のバックスラッシュエスケープを扱う', () => {
    const lines = splitLogicalLines('s = """a\\"""\nstill string"""\nz = 1')
    expect(lines.map(l => l.text)).toHaveLength(2)
  })
})
