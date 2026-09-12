import type { TraceStep } from './types'

export type StepSpeed = 1 | 2 | 3

export interface SessionState {
  steps: TraceStep[]
  index: number
  playing: boolean
  speed: StepSpeed
}

const SPEED_DELAYS_MS: Record<StepSpeed, number> = { 1: 900, 2: 450, 3: 150 }

export function createSession(steps: TraceStep[]): SessionState {
  return { steps, index: 0, playing: false, speed: 2 }
}

export function currentStep(state: SessionState): TraceStep | null {
  return state.steps[state.index] ?? null
}

export function canGoNext(state: SessionState): boolean {
  return state.index < state.steps.length - 1
}

export function canGoPrev(state: SessionState): boolean {
  return state.index > 0
}

export function next(state: SessionState): SessionState {
  if (!canGoNext(state)) return { ...state, playing: false }
  return { ...state, index: state.index + 1 }
}

export function prev(state: SessionState): SessionState {
  if (!canGoPrev(state)) return state
  return { ...state, index: state.index - 1, playing: false }
}

export function first(state: SessionState): SessionState {
  return { ...state, index: 0, playing: false }
}

export function last(state: SessionState): SessionState {
  return { ...state, index: Math.max(0, state.steps.length - 1), playing: false }
}

export function seekTo(state: SessionState, index: number): SessionState {
  const clamped = Math.min(Math.max(0, index), Math.max(0, state.steps.length - 1))
  return { ...state, index: clamped, playing: false }
}

export function play(state: SessionState): SessionState {
  if (!canGoNext(state)) return state
  return { ...state, playing: true }
}

export function pause(state: SessionState): SessionState {
  return { ...state, playing: false }
}

export function setSpeed(state: SessionState, speed: StepSpeed): SessionState {
  return { ...state, speed }
}

export function speedDelayMs(state: SessionState): number {
  return SPEED_DELAYS_MS[state.speed]
}

// 自動再生の1tick分の進行。末尾に達したら自動的に再生を止める。
export function tick(state: SessionState): SessionState {
  if (!state.playing) return state
  if (!canGoNext(state)) return { ...state, playing: false }
  return next(state)
}

// 先頭から現在のステップまでの標準出力を連結する。出力をステップの進行に
// 同期させるため、まだ到達していないステップの出力は含めない。
export function cumulativeStdout(state: SessionState): string {
  let text = ''
  for (let i = 0; i <= state.index && i < state.steps.length; i++) {
    text += state.steps[i].stdout
  }
  return text
}
