import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFontSize, setFontSize, normalFontProfile } from './fontSize'

// environment: 'node' のため localStorage が存在しない。テストに必要な最小限の
// Storage 実装だけを vi.stubGlobal でスタブし、jsdom 化は避ける（他の全テストへの
// 影響を防ぐため）。
function createLocalStorageStub(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size },
  }
}

describe('editor font size', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未設定時はデフォルト値(13)を返す', () => {
    expect(getFontSize()).toBe(13)
  })

  it('保存した値を復元できる', () => {
    setFontSize(18)
    expect(getFontSize()).toBe(18)
  })

  it('範囲外の値はクランプされる', () => {
    setFontSize(1)
    expect(getFontSize()).toBe(10)
    setFontSize(100)
    expect(getFontSize()).toBe(24)
  })

  it('不正値はデフォルトにフォールバックする', () => {
    localStorage.setItem('narapy-font-size-v1', 'not-a-number')
    expect(getFontSize()).toBe(13)
  })

  it('normalFontProfileはgetFontSize/setFontSizeと同じ挙動をする', () => {
    normalFontProfile.set(20)
    expect(normalFontProfile.get()).toBe(20)
    expect(getFontSize()).toBe(20)
  })
})
