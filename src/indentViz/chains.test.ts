import { describe, expect, it } from 'vitest'
import { groupChains, isCompound } from './chains'
import { parseIndentTree } from './parse'

function grouped(source: string): string[][] {
  return groupChains(parseIndentTree(source)).map(g => g.map(n => n.type))
}

describe('groupChains', () => {
  it('if / elif / else を1つにまとめる', () => {
    expect(grouped('if a:\n    pass\nelif b:\n    pass\nelif c:\n    pass\nelse:\n    pass'))
      .toEqual([['if', 'elif', 'elif', 'else']])
  })

  it('else の後ろの elif は続けない', () => {
    expect(grouped('if a:\n    pass\nelse:\n    pass\nelif b:\n    pass')).toEqual([['if', 'else'], ['elif']])
  })

  it('try / except / else / finally を1つにまとめる', () => {
    expect(grouped('try:\n    pass\nexcept A:\n    pass\nexcept B:\n    pass\nelse:\n    pass\nfinally:\n    pass'))
      .toEqual([['try', 'except', 'except', 'else', 'finally']])
    expect(grouped('try:\n    pass\nfinally:\n    pass')).toEqual([['try', 'finally']])
  })

  it('try の直後の else（except なし）や finally の後ろの except は続けない', () => {
    expect(grouped('try:\n    pass\nelse:\n    pass')).toEqual([['try'], ['else']])
    expect(grouped('try:\n    pass\nfinally:\n    pass\nexcept A:\n    pass')).toEqual([['try', 'finally'], ['except']])
  })

  it('for / while の else を続ける', () => {
    expect(grouped('for i in x:\n    pass\nelse:\n    pass')).toEqual([['for', 'else']])
    expect(grouped('while a:\n    pass\nelse:\n    pass')).toEqual([['while', 'else']])
  })

  it('別々の if は混ぜない', () => {
    expect(grouped('if a:\n    pass\nif b:\n    pass')).toEqual([['if'], ['if']])
  })

  it('間に別の文が挟まれば続けない', () => {
    expect(grouped('if a:\n    pass\nx = 1\nelse:\n    pass')).toEqual([['if'], ['assignment'], ['else']])
  })

  it('対応する先頭のない elif / else も単独で残す', () => {
    expect(grouped('else:\n    pass\nelif a:\n    pass')).toEqual([['else'], ['elif']])
  })

  it('各節は自分の行番号を持ったまま順序を保つ', () => {
    const [group] = groupChains(parseIndentTree('if a:\n    pass\nelse:\n    pass'))
    expect(group.map(n => n.line)).toEqual([1, 3])
  })

  it('空なら空', () => {
    expect(groupChains([])).toEqual([])
  })
})

describe('isCompound', () => {
  it('複合文だけが C 字型ブロックになる', () => {
    expect(isCompound('if')).toBe(true)
    expect(isCompound('method')).toBe(true)
    expect(isCompound('assignment')).toBe(false)
    expect(isCompound('import')).toBe(false)
    expect(isCompound('other')).toBe(false)
  })
})
