import { describe, expect, it } from 'vitest'
import { resolveTheme } from './index'

describe('resolveTheme', () => {
  it('明示選択はシステム設定を無視する', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  // style.css は data-theme が無いときだけ prefers-color-scheme: light を効かせる。
  // TS 側の解決もそれと一致していないと、Monaco だけ配色がずれる。
  it('system はシステムのライト設定に追従し、既定はダーク', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
  })
})
