import { describe, expect, it } from 'vitest'
import { shouldConvert, shouldResyncOnReveal } from './conversionGuard'

describe('shouldConvert', () => {
  it('Blocklyパネルが非表示のときは変換しない', () => {
    expect(shouldConvert(true)).toBe(false)
  })

  it('Blocklyパネルが表示中のときは変換する', () => {
    expect(shouldConvert(false)).toBe(true)
  })
})

describe('shouldResyncOnReveal', () => {
  it('非表示から表示に変わり、エディタがアクティブなら再同期する', () => {
    expect(shouldResyncOnReveal(false, 'editor')).toBe(true)
  })

  it('表示状態でもBlocklyがアクティブなら再同期しない', () => {
    expect(shouldResyncOnReveal(false, 'blockly')).toBe(false)
  })

  it('非表示のままなら再同期しない', () => {
    expect(shouldResyncOnReveal(true, 'editor')).toBe(false)
  })

  it('非表示かつBlocklyアクティブでも再同期しない', () => {
    expect(shouldResyncOnReveal(true, 'blockly')).toBe(false)
  })
})
