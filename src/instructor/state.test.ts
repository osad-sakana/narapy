import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInstructorEnabled, setInstructorEnabled } from './state'

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

describe('instructor state', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未設定時はfalseを返す', () => {
    expect(getInstructorEnabled()).toBe(false)
  })

  it('trueを保存すると復元できる', () => {
    setInstructorEnabled(true)
    expect(getInstructorEnabled()).toBe(true)
  })

  it('falseを保存すると復元できる', () => {
    setInstructorEnabled(true)
    setInstructorEnabled(false)
    expect(getInstructorEnabled()).toBe(false)
  })

  it('不正値はfalseにフォールバックする', () => {
    localStorage.setItem('narapy-instructor-v1', 'not-a-boolean')
    expect(getInstructorEnabled()).toBe(false)
  })

  it('localStorageが例外を投げてもfalseを返す', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
    } as unknown as Storage)
    expect(getInstructorEnabled()).toBe(false)
  })
})
