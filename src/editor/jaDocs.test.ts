import { describe, expect, it } from 'vitest'
import { lookupJaDoc, lookupJaParam, paramName } from './jaDocs'

describe('lookupJaDoc', () => {
  it('組み込み関数・メソッド・random を引ける', () => {
    expect(lookupJaDoc('builtins.print')?.summary).toContain('表示')
    expect(lookupJaDoc('builtins.str.join')?.summary).toContain('つないで')
    expect(lookupJaDoc('random.randint')?.summary).toContain('ランダム')
  })

  it('random.Random.xxx（束ねられたメソッド）も random.xxx と同じ項目を引く', () => {
    expect(lookupJaDoc('random.Random.randint')).toBe(lookupJaDoc('random.randint'))
    expect(lookupJaDoc('random.Random.nothing')).toBeUndefined()
  })

  it('辞書にない名前や prototype のキーは undefined', () => {
    expect(lookupJaDoc('math.sin')).toBeUndefined()
    expect(lookupJaDoc('constructor')).toBeUndefined()
    expect(lookupJaDoc('__proto__')).toBeUndefined()
    expect(lookupJaDoc('')).toBeUndefined()
  })

  it('すべての項目に要約があり、引数説明は空でない', () => {
    for (const name of [
      'builtins.print', 'builtins.range', 'builtins.open', 'builtins.list.sort',
      'random.randrange', 'random.sample', 'typing.Mapping.get',
    ]) {
      const doc = lookupJaDoc(name)
      expect(doc?.summary).not.toBe('')
      for (const text of Object.values(doc?.params ?? {})) expect(text).not.toBe('')
    }
  })
})

describe('paramName', () => {
  it.each([
    ['sep: Optional[str]=...', 'sep'],
    ['*values: object', 'values'],
    ['**kwargs: _VT', 'kwargs'],
    ['*_args: SupportsLessThanT', '_args'],
    ['stop', 'stop'],
    ['', ''],
    ['=...', ''],
  ])('%s → %s', (label, expected) => {
    expect(paramName(label)).toBe(expected)
  })
})

describe('lookupJaParam', () => {
  const doc = lookupJaDoc('builtins.range')

  it('引数ラベルから説明を引く', () => {
    expect(lookupJaParam(doc, 'step: int=...')).toContain('増やす幅')
  })

  it('辞書にない引数・辞書自体がない場合は undefined', () => {
    expect(lookupJaParam(doc, 'nope: int')).toBeUndefined()
    expect(lookupJaParam(undefined, 'step: int')).toBeUndefined()
    expect(lookupJaParam(lookupJaDoc('builtins.float'), 'x')).toBeUndefined()
    expect(lookupJaParam(doc, 'constructor: int')).toBeUndefined()
  })
})
