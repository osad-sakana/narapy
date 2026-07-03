import { describe, expect, it } from 'vitest'
import { resolveBlocklyCollapsed } from './index'

describe('resolveBlocklyCollapsed', () => {
  it('Blockly有効時は保存された折りたたみ状態をそのまま使う', () => {
    expect(resolveBlocklyCollapsed(true, false)).toBe(false)
    expect(resolveBlocklyCollapsed(true, true)).toBe(true)
  })

  it('Blockly無効時はパネルが存在しないため常に折りたたみ扱いにする', () => {
    expect(resolveBlocklyCollapsed(false, false)).toBe(true)
    expect(resolveBlocklyCollapsed(false, true)).toBe(true)
  })
})
