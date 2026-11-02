import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLintRequester } from './requester'

const warning = { name: 'print', kind: 'expr', line: 1, col: 1, endCol: 6 }

function setup(maxChars = 100) {
  let id = 0
  const posted: Array<{ type: 'lint'; id: number; code: string }> = []
  const requester = createLintRequester({
    nextId: () => ++id,
    post: m => posted.push(m),
    timeoutMs: 1000,
    maxChars,
  })
  return { requester, posted }
}

describe('createLintRequester', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('応答を ok として解決する', async () => {
    const { requester, posted } = setup()
    const p = requester.request('print')
    expect(requester.handle({ type: 'linted', id: posted[0]!.id, result: { status: 'ok', warnings: [warning] } })).toBe(true)
    await expect(p).resolves.toEqual({ status: 'ok', warnings: [warning] })
  })

  it('新しい要求が来たら古い要求は superseded になる', async () => {
    const { requester, posted } = setup()
    const first = requester.request('a')
    const second = requester.request('b')
    await expect(first).resolves.toEqual({ status: 'superseded' })
    requester.handle({ type: 'linted', id: posted[1]!.id, result: { status: 'ok', warnings: [] } })
    await expect(second).resolves.toEqual({ status: 'ok', warnings: [] })
  })

  it('上限を超えるコードは too_large で、Worker へ送らない', async () => {
    const { requester, posted } = setup(3)
    await expect(requester.request('abcd')).resolves.toEqual({ status: 'too_large' })
    expect(posted).toHaveLength(0)
  })

  it('タイムアウトする', async () => {
    const { requester } = setup()
    const p = requester.request('x')
    vi.advanceTimersByTime(1000)
    await expect(p).resolves.toEqual({ status: 'timeout' })
  })

  it('不正な応答・lint_error は unavailable', async () => {
    const { requester, posted } = setup()
    const p = requester.request('x')
    requester.handle({ type: 'linted', id: posted[0]!.id, result: { status: 'ok' } })
    await expect(p).resolves.toEqual({ status: 'unavailable' })
    const q = requester.request('y')
    requester.handle({ type: 'lint_error', id: posted[1]!.id })
    await expect(q).resolves.toEqual({ status: 'unavailable' })
  })

  it('failAll で待機中を unavailable にする', async () => {
    const { requester } = setup()
    const p = requester.request('x')
    requester.failAll()
    await expect(p).resolves.toEqual({ status: 'unavailable' })
  })

  it('lint 以外のメッセージは処理しない。ID 不一致は握りつぶすだけ', () => {
    const { requester } = setup()
    expect(requester.handle({ type: 'completions', id: 1 })).toBe(false)
    expect(requester.handle({ type: 'linted', id: 99, result: {} })).toBe(true)
  })
})
