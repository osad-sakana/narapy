import { describe, it, expect } from 'vitest'
import { typeLabel } from './typeLabel'

describe('typeLabel', () => {
  it.each([
    ['int', 'int（整数）'],
    ['float', 'float（小数）'],
    ['str', 'str（文字列）'],
    ['bool', 'bool（真偽値）'],
    ['list', 'list（リスト）'],
    ['tuple', 'tuple（タプル）'],
    ['dict', 'dict（辞書）'],
    ['set', 'set（集合）'],
    ['NoneType', 'NoneType（なし）'],
  ])('基本の型 %s は日本語表記を添える', (type, expected) => {
    expect(typeLabel(type)).toBe(expected)
  })

  it('基本の型以外はそのまま返す', () => {
    expect(typeLabel('Counter')).toBe('Counter')
    expect(typeLabel('function')).toBe('function')
  })
})
