import { describe, expect, it } from 'vitest'
import { isBlocklyEnabled } from './featureFlag'

describe('isBlocklyEnabled', () => {
  it('クエリパラメータがない場合は無効', () => {
    expect(isBlocklyEnabled('')).toBe(false)
  })

  it('blockly=1が付いている場合は有効', () => {
    expect(isBlocklyEnabled('?blockly=1')).toBe(true)
  })

  it('blockly=0や想定外の値では無効', () => {
    expect(isBlocklyEnabled('?blockly=0')).toBe(false)
    expect(isBlocklyEnabled('?blockly=true')).toBe(false)
  })

  it('他のパラメータと併存していても判定できる', () => {
    expect(isBlocklyEnabled('?project=foo&blockly=1')).toBe(true)
  })

  it('値のない空パラメータでは無効', () => {
    expect(isBlocklyEnabled('?blockly')).toBe(false)
  })

  it('パラメータが重複している場合は最初の値が使われる', () => {
    expect(isBlocklyEnabled('?blockly=0&blockly=1')).toBe(false)
  })
})
