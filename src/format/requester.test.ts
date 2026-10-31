import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFormatRequester } from './requester'

describe('createFormatRequester', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const setup = (maxChars = 100) => {
    const post = vi.fn()
    const r = createFormatRequester({ nextId: (() => { let i = 0; return () => ++i })(), post, timeoutMs: 1000, maxChars })
    return { post, r }
  }

  it('上限超えは too_large で、Workerへ送らない', async () => {
    const { post, r } = setup(3)
    await expect(r.request('abcd')).resolves.toEqual({ status: 'too_large' })
    expect(post).not.toHaveBeenCalled()
  })

  it('formatted を受けると結果で解決する', async () => {
    const { post, r } = setup()
    const p = r.request('x')
    const { id } = post.mock.calls[0][0]
    r.handle({ type: 'formatted', id, result: { status: 'ok', code: 'y' } })
    await expect(p).resolves.toEqual({ status: 'ok', code: 'y' })
  })

  it('不正な結果は unavailable', async () => {
    const { post, r } = setup()
    const p = r.request('x')
    r.handle({ type: 'formatted', id: post.mock.calls[0][0].id, result: { status: 'bogus' } })
    await expect(p).resolves.toEqual({ status: 'unavailable' })
  })

  it('format_error は unavailable', async () => {
    const { post, r } = setup()
    const p = r.request('x')
    r.handle({ type: 'format_error', id: post.mock.calls[0][0].id })
    await expect(p).resolves.toEqual({ status: 'unavailable' })
  })

  it('タイムアウトで timeout になり、遅れて届いた結果は無視される', async () => {
    const { post, r } = setup()
    const p = r.request('x')
    vi.advanceTimersByTime(1000)
    await expect(p).resolves.toEqual({ status: 'timeout' })
    expect(r.handle({ type: 'formatted', id: post.mock.calls[0][0].id, result: { status: 'rejected' } })).toBe(true)
  })

  it('failAll で待機中をすべて unavailable にする', async () => {
    const { r } = setup()
    const p1 = r.request('a')
    const p2 = r.request('b')
    r.failAll()
    await expect(Promise.all([p1, p2])).resolves.toEqual([{ status: 'unavailable' }, { status: 'unavailable' }])
  })

  it('整形以外のメッセージは false を返す', () => {
    const { r } = setup()
    expect(r.handle({ type: 'completions', id: 1 })).toBe(false)
  })
})
