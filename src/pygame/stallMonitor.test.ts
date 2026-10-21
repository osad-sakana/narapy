import { describe, expect, it } from 'vitest'
import { INITIAL_STALL_STATE, nextStallState } from './stallMonitor'

const STALL_MS = 5000
const HIDDEN_STALL_MS = 90_000

describe('nextStallState', () => {
  it('心拍が進んでいる間は停止と判定しない', () => {
    let state = { counter: 0, changedAt: 0 }
    for (let t = 500; t <= 20_000; t += 500) {
      const result = nextStallState(state, t, t / 500, false, STALL_MS, HIDDEN_STALL_MS)
      expect(result.stalled).toBe(false)
      state = result.state
    }
  })

  it('心拍が止まって stallMs 経過したら停止と判定する', () => {
    const state = { counter: 3, changedAt: 1000 }
    expect(nextStallState(state, 5999, 3, false, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(false)
    expect(nextStallState(state, 6000, 3, false, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(true)
  })

  it('停止判定後は計測を仕切り直し、続けて判定しない', () => {
    const first = nextStallState({ counter: 3, changedAt: 0 }, 6000, 3, false, STALL_MS, HIDDEN_STALL_MS)
    expect(first.stalled).toBe(true)
    expect(nextStallState(first.state, 7000, 3, false, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(false)
    expect(nextStallState(first.state, 11_000, 3, false, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(true)
  })

  it('タブが非表示の間は閾値を長くし、タイマーの間引きによる誤検知を避ける', () => {
    const state = { counter: 3, changedAt: 0 }
    expect(nextStallState(state, 60_000, 3, true, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(false)
    expect(nextStallState(state, 89_999, 3, true, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(false)
  })

  it('非表示のまま固まった場合も、長い閾値を過ぎれば停止と判定する', () => {
    // 固まったメインスレッドは「表示に戻った」通知を処理できないため、非表示扱いのままになる
    const state = { counter: 3, changedAt: 0 }
    expect(nextStallState(state, 90_000, 3, true, STALL_MS, HIDDEN_STALL_MS).stalled).toBe(true)
  })

  it('非表示中でも心拍が進んでいれば停止と判定しない（1 分に 1 回の間引き相当）', () => {
    let state = { counter: 0, changedAt: 0 }
    for (let i = 1; i <= 5; i++) {
      const result = nextStallState(state, i * 60_000, i, true, STALL_MS, HIDDEN_STALL_MS)
      expect(result.stalled).toBe(false)
      state = result.state
    }
  })

  it('入力の状態オブジェクトを変更しない', () => {
    const state = Object.freeze({ counter: 3, changedAt: 0 })
    expect(() => nextStallState(state, 6000, 3, false, STALL_MS, HIDDEN_STALL_MS)).not.toThrow()
  })

  it('初期状態は最初の観測で計測を開始する', () => {
    const result = nextStallState(INITIAL_STALL_STATE, 1000, 0, false, STALL_MS, HIDDEN_STALL_MS)
    expect(result.stalled).toBe(false)
    expect(result.state).toEqual({ counter: 0, changedAt: 1000 })
  })
})
