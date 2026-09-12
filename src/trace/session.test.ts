import { describe, expect, it } from 'vitest'
import {
  createSession, currentStep, canGoNext, canGoPrev,
  next, prev, first, last, seekTo, play, pause, setSpeed, speedDelayMs, tick,
  cumulativeStdout, displayStdout,
} from './session'
import type { TraceStep } from './types'

function makeStep(line: number, stdout = ''): TraceStep {
  return { line, event: 'line', funcName: '<module>', depth: 0, locals: [], globals: null, stdout }
}

const STEPS = [makeStep(1), makeStep(2), makeStep(3)]

describe('session', () => {
  it('createSession は index 0 から始まる', () => {
    const state = createSession(STEPS)
    expect(state.index).toBe(0)
    expect(state.playing).toBe(false)
    expect(currentStep(state)?.line).toBe(1)
  })

  it('next で index が進み、元のstateは変更されない', () => {
    const state = createSession(STEPS)
    const advanced = next(state)
    expect(advanced.index).toBe(1)
    expect(state.index).toBe(0) // イミュータブル
  })

  it('末尾では next しても進まない', () => {
    const state = last(createSession(STEPS))
    expect(canGoNext(state)).toBe(false)
    const advanced = next(state)
    expect(advanced.index).toBe(state.index)
  })

  it('先頭では prev しても進まない', () => {
    const state = createSession(STEPS)
    expect(canGoPrev(state)).toBe(false)
    const moved = prev(state)
    expect(moved.index).toBe(0)
  })

  it('first/last で境界に移動する', () => {
    const state = createSession(STEPS)
    expect(last(state).index).toBe(2)
    expect(first(last(state)).index).toBe(0)
  })

  it('seekTo は範囲外の値をクランプする', () => {
    const state = createSession(STEPS)
    expect(seekTo(state, 100).index).toBe(2)
    expect(seekTo(state, -5).index).toBe(0)
    expect(seekTo(state, 1).index).toBe(1)
  })

  it('steps が空の場合、last/seekTo は index 0 に留まる', () => {
    const state = createSession([])
    expect(last(state).index).toBe(0)
    expect(seekTo(state, 5).index).toBe(0)
  })

  it('play/pause は playing フラグを切り替える', () => {
    const state = createSession(STEPS)
    expect(play(state).playing).toBe(true)
    expect(pause(play(state)).playing).toBe(false)
  })

  it('末尾では play しても再生状態にならない', () => {
    const state = last(createSession(STEPS))
    expect(play(state).playing).toBe(false)
  })

  it('tick は再生中のみ進み、末尾で自動停止する', () => {
    const playing = play(createSession(STEPS))
    const afterTick = tick(playing)
    expect(afterTick.index).toBe(1)
    expect(afterTick.playing).toBe(true)

    const atLast = tick(tick(afterTick))
    expect(atLast.index).toBe(2)
    const stopped = tick(atLast)
    expect(stopped.playing).toBe(false)
    expect(stopped.index).toBe(2)
  })

  it('再生中でなければ tick は何もしない', () => {
    const state = createSession(STEPS)
    expect(tick(state)).toEqual(state)
  })

  it('setSpeed/speedDelayMs で速度ごとの待機時間が変わる', () => {
    const state = createSession(STEPS)
    const slow = setSpeed(state, 1)
    const fast = setSpeed(state, 3)
    expect(speedDelayMs(slow)).toBeGreaterThan(speedDelayMs(fast))
  })

  describe('cumulativeStdout', () => {
    it('先頭から現在のステップまでの出力を連結する', () => {
      const steps = [makeStep(1, 'a\n'), makeStep(2, ''), makeStep(3, 'b\n')]
      const state = createSession(steps)
      expect(cumulativeStdout(state)).toBe('a\n')
      expect(cumulativeStdout(seekTo(state, 1))).toBe('a\n')
      expect(cumulativeStdout(seekTo(state, 2))).toBe('a\nb\n')
    })

    it('steps が空の場合は空文字列を返す', () => {
      expect(cumulativeStdout(createSession([]))).toBe('')
    })
  })

  describe('displayStdout', () => {
    it('最後のステップでなければ trailingStdout を含めない', () => {
      const steps = [makeStep(1, 'a\n'), makeStep(2, 'b\n')]
      const state = seekTo(createSession(steps), 0)
      expect(displayStdout(state, '打ち切り後の出力')).toBe('a\n')
    })

    it('最後のステップに到達したら trailingStdout を末尾に付け足す', () => {
      const steps = [makeStep(1, 'a\n'), makeStep(2, 'b\n')]
      const state = last(createSession(steps))
      expect(displayStdout(state, '打ち切り後の出力')).toBe('a\nb\n打ち切り後の出力')
    })

    it('trailingStdout が空文字列なら何も付け足さない', () => {
      const state = last(createSession([makeStep(1, 'a\n')]))
      expect(displayStdout(state, '')).toBe('a\n')
    })
  })
})
