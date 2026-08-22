import { describe, expect, it, vi } from 'vitest'
import { confirmNewProject } from './confirmNewProject'

describe('confirmNewProject', () => {
  it('確認関数がtrueを返せばtrue', () => {
    expect(confirmNewProject(vi.fn().mockReturnValue(true))).toBe(true)
  })

  it('確認関数がfalseを返せばfalse', () => {
    expect(confirmNewProject(vi.fn().mockReturnValue(false))).toBe(false)
  })

  it('確認メッセージを渡して呼び出す', () => {
    const confirmFn = vi.fn().mockReturnValue(true)
    confirmNewProject(confirmFn)
    expect(confirmFn).toHaveBeenCalledWith(expect.stringContaining('新規プロジェクト'))
  })
})
