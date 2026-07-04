import { describe, expect, it, vi } from 'vitest'
import { confirmOverwriteExistingWork } from './confirmOverwrite'

describe('confirmOverwriteExistingWork', () => {
  it('確認関数がtrueを返せばtrue', () => {
    expect(confirmOverwriteExistingWork(vi.fn().mockReturnValue(true))).toBe(true)
  })

  it('確認関数がfalseを返せばfalse', () => {
    expect(confirmOverwriteExistingWork(vi.fn().mockReturnValue(false))).toBe(false)
  })

  it('確認メッセージを渡して呼び出す', () => {
    const confirmFn = vi.fn().mockReturnValue(true)
    confirmOverwriteExistingWork(confirmFn)
    expect(confirmFn).toHaveBeenCalledWith(expect.stringContaining('URL'))
  })
})
