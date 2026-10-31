import { describe, expect, it } from 'vitest'
import { JA_DOCS, lookupJaDoc, lookupJaParam, paramName } from './jaDocs'

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

  it('random.random（_random.Random.random）も引ける', () => {
    expect(lookupJaDoc('_random.Random.random')).toBe(lookupJaDoc('random.random'))
  })

  it('全項目に要約があり、引数名・説明は空でなく、キーは jedi の full_name の形', () => {
    const entries = Object.entries(JA_DOCS)
    expect(entries.length).toBeGreaterThan(60)
    for (const [key, doc] of entries) {
      expect(key).toMatch(/^[\w.]+$/)
      expect(doc.summary.trim()).not.toBe('')
      for (const [name, text] of Object.entries(doc.params ?? {})) {
        expect(name).toMatch(/^[A-Za-z_]\w*$/)
        expect(text.trim()).not.toBe('')
      }
    }
  })

  it('randrange は引数が1つのときの意味を説明している', () => {
    expect(lookupJaDoc('random.randrange')?.params?.start).toContain('1つだけ')
  })

  it('round は四捨五入ではなく偶数丸めであることを説明している', () => {
    const summary = lookupJaDoc('builtins.round')?.summary ?? ''
    expect(summary).toContain('偶数')
    expect(summary).toContain('異なります')
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
