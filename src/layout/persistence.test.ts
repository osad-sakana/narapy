import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STATE, STORAGE_KEY, load, save } from './persistence'

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

describe('layout persistence: save / load', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageStub())
  })

  it('load: localStorage 未設定時は DEFAULT_STATE を返す', () => {
    expect(load()).toEqual(DEFAULT_STATE)
  })

  it('load: 壊れたJSONを読んだ場合は例外を投げず DEFAULT_STATE にフォールバックする', () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not valid json')
    expect(() => load()).not.toThrow()
    expect(load()).toEqual(DEFAULT_STATE)
  })

  it('save: 渡した patch の値が永続化される', () => {
    save({ editorCollapsed: true })
    expect(load().editorCollapsed).toBe(true)
  })

  it('save: patch に含まれない既存キーの値は load() とのマージにより保持される', () => {
    save({ vertical: [30, 70] })
    save({ logCollapsed: true })
    const state = load()
    expect(state.vertical).toEqual([30, 70])
    expect(state.logCollapsed).toBe(true)
  })

  it('save: 旧キー(horizontal / blocklyCollapsed)を書き出さない', () => {
    // Blockly廃止前のユーザーのlocalStorageを模して、旧キーを含む状態から書き込む
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_STATE, horizontal: [50, 50], blocklyCollapsed: false }),
    )
    save({ editorCollapsed: true })
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!) as Record<string, unknown>
    expect(persisted).not.toHaveProperty('horizontal')
    expect(persisted).not.toHaveProperty('blocklyCollapsed')
    expect(Object.keys(persisted).sort()).toEqual(['editorCollapsed', 'logCollapsed', 'vertical'])
  })
})
