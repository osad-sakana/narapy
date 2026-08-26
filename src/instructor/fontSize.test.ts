import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getInstructorFontSize,
  setInstructorFontSize,
  INSTRUCTOR_FONT_DEFAULT,
  INSTRUCTOR_FONT_MIN,
  INSTRUCTOR_FONT_MAX,
} from './fontSize'

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

describe('instructor font size', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('未設定時はデフォルト値を返す', () => {
    expect(getInstructorFontSize()).toBe(INSTRUCTOR_FONT_DEFAULT)
  })

  it('保存した値を復元できる', () => {
    setInstructorFontSize(24)
    expect(getInstructorFontSize()).toBe(24)
  })

  it('MIN未満はMINにクランプされる', () => {
    setInstructorFontSize(0)
    expect(getInstructorFontSize()).toBe(INSTRUCTOR_FONT_MIN)
  })

  it('MAX超過はMAXにクランプされる', () => {
    setInstructorFontSize(999)
    expect(getInstructorFontSize()).toBe(INSTRUCTOR_FONT_MAX)
  })

  it('不正値（数値でない）はデフォルトにフォールバックする', () => {
    localStorage.setItem('narapy-instructor-font-size-v1', 'abc')
    expect(getInstructorFontSize()).toBe(INSTRUCTOR_FONT_DEFAULT)
  })

  it('localStorageが例外を投げてもデフォルトを返す', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
    } as unknown as Storage)
    expect(getInstructorFontSize()).toBe(INSTRUCTOR_FONT_DEFAULT)
  })
})
