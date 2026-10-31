import { describe, expect, it } from 'vitest'
import { META_FIELD_MAX_CHARS, parseCompletionItems } from './completionMeta'

describe('parseCompletionItems', () => {
  it('メタ情報つきの項目を受け取る', () => {
    const items = parseCompletionItems([
      { name: 'randint', type: 'function', module: 'random', parent: 'random', parentType: 'module', line: 12, fullName: 'random.randint' },
    ])
    expect(items).toEqual([
      { name: 'randint', type: 'function', module: 'random', parent: 'random', parentType: 'module', line: 12, fullName: 'random.randint' },
    ])
  })

  it('旧形式 {name,type} はメタ情報を空文字で補う', () => {
    expect(parseCompletionItems([{ name: 'a', type: 'instance' }])).toEqual([
      { name: 'a', type: 'instance', module: '', parent: '', parentType: '', line: 0, fullName: '' },
    ])
  })

  it('配列以外は空配列', () => {
    expect(parseCompletionItems(null)).toEqual([])
    expect(parseCompletionItems({})).toEqual([])
    expect(parseCompletionItems('x')).toEqual([])
  })

  it('name が欠落・空・非文字列、type が非文字列の項目は除外する', () => {
    expect(
      parseCompletionItems([
        null,
        1,
        { type: 'function' },
        { name: '', type: 'function' },
        { name: 1, type: 'function' },
        { name: 'ok', type: 1 },
        { name: 'good', type: 'function' },
      ]).map((i) => i.name),
    ).toEqual(['good'])
  })

  it('メタ情報が非文字列なら空文字にする', () => {
    const [item] = parseCompletionItems([{ name: 'a', type: 'function', module: 1, parent: null, parentType: {} }])
    expect(item).toMatchObject({ module: '', parent: '', parentType: '' })
  })

  it('メタ情報は長さを制限し制御文字を除去する', () => {
    const [item] = parseCompletionItems([
      { name: 'a', type: 'function', module: 'm'.repeat(500), parent: 'p\u0000\n q', parentType: 'class' },
    ])
    expect(item.module).toHaveLength(META_FIELD_MAX_CHARS)
    expect(item.parent).toBe('p q')
  })

  it('line は正の整数以外を 0 にする', () => {
    const lines = [-1, 1.5, '3', null, NaN, 0, 7].map(
      (line) => parseCompletionItems([{ name: 'a', type: 'function', line }])[0].line,
    )
    expect(lines).toEqual([0, 0, 0, 0, 0, 0, 7])
  })
})
