import { describe, expect, it } from 'vitest'
import { loadOpenState, saveOpenState } from './openState'

describe('openState', () => {
  it('保存がなければ開く', () => {
    expect(loadOpenState({ getItem: () => null })).toBe(true)
    expect(loadOpenState(null)).toBe(true)
  })

  it('閉じた状態を復元できる', () => {
    const store = new Map<string, string>()
    saveOpenState({ setItem: (k, v) => void store.set(k, v) }, false)
    expect(loadOpenState({ getItem: k => store.get(k) ?? null })).toBe(false)
  })

  it('ストレージが例外を投げても落ちない', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(loadOpenState(broken)).toBe(true)
    expect(() => saveOpenState(broken, true)).not.toThrow()
  })
})
