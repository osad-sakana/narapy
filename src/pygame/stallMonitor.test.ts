import { describe, expect, it } from 'vitest'
import { INITIAL_STALL_STATE, nextStallState } from './stallMonitor'

const STALL_MS = 5000

describe('nextStallState', () => {
  it('心拍が進んでいる間は停止と判定しない', () => {
    let state = { counter: 0, changedAt: 0 }
    for (let t = 500; t <= 20_000; t += 500) {
      const result = nextStallState(state, t, t / 500, false, STALL_MS)
      expect(result.stalled).toBe(false)
      state = result.state
    }
  })

  it('心拍が止まって stallMs 経過したら停止と判定する', () => {
    const state = { counter: 3, changedAt: 1000 }
    expect(nextStallState(state, 5999, 3, false, STALL_MS).stalled).toBe(false)
    expect(nextStallState(state, 6000, 3, false, STALL_MS).stalled).toBe(true)
  })

  it('停止判定後は計測を仕切り直し、続けて判定しない', () => {
    const first = nextStallState({ counter: 3, changedAt: 0 }, 6000, 3, false, STALL_MS)
    expect(first.stalled).toBe(true)
    expect(nextStallState(first.state, 7000, 3, false, STALL_MS).stalled).toBe(false)
    expect(nextStallState(first.state, 11_000, 3, false, STALL_MS).stalled).toBe(true)
  })

  it('タブが非表示の間は心拍が止まっても停止と判定しない', () => {
    const state = { counter: 3, changedAt: 0 }
    const hidden = nextStallState(state, 60_000, 3, true, STALL_MS)
    expect(hidden.stalled).toBe(false)
    // 表示に戻った直後から改めて計測する
    expect(nextStallState(hidden.state, 62_000, 3, false, STALL_MS).stalled).toBe(false)
  })

  it('入力の状態オブジェクトを変更しない', () => {
    const state = Object.freeze({ counter: 3, changedAt: 0 })
    expect(() => nextStallState(state, 6000, 3, false, STALL_MS)).not.toThrow()
  })

  it('初期状態は最初の観測で計測を開始する', () => {
    const result = nextStallState(INITIAL_STALL_STATE, 1000, 0, false, STALL_MS)
    expect(result.stalled).toBe(false)
    expect(result.state).toEqual({ counter: 0, changedAt: 1000 })
  })
})
