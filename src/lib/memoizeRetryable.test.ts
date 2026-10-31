import { describe, expect, it, vi } from 'vitest'
import { memoizeRetryable } from './memoizeRetryable'

describe('memoizeRetryable', () => {
  it('成功した結果はメモされ、再実行されない', async () => {
    const fn = vi.fn(async () => 1)
    const get = memoizeRetryable(fn)
    await get()
    await get()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('失敗するとメモが消え、次の呼び出しで再試行される', async () => {
    const fn = vi.fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(2)
    const get = memoizeRetryable(fn)
    await expect(get()).rejects.toThrow('x')
    await expect(get()).resolves.toBe(2)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('実行中は同じ Promise を共有する', async () => {
    const fn = vi.fn(async () => 1)
    const get = memoizeRetryable(fn)
    const a = get()
    expect(get()).toBe(a)
    await a
  })

  it('古い試行の失敗が新しい試行のメモを消さない', async () => {
    let rejectFirst: (e: Error) => void = () => undefined
    const fn = vi.fn<() => Promise<number>>()
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej }))
      .mockResolvedValueOnce(3)
    const get = memoizeRetryable(fn)
    const first = get()
    first.catch(() => undefined)
    // 1回目が失敗扱いになる前に reset して2回目を始めるケースを模す
    get.reset()
    await expect(get()).resolves.toBe(3)
    rejectFirst(new Error('late'))
    await first.catch(() => undefined)
    await get()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
