export interface StallState {
  counter: number
  changedAt: number
}

export const INITIAL_STALL_STATE: StallState = { counter: -1, changedAt: 0 }

// メインスレッドの心拍（counter）が進まない時間を見て、固まったか判定する純粋関数。
// タブ非表示中はブラウザがタイマーを間引くため、停止とみなさず計測を仕切り直す。
export function nextStallState(
  state: StallState,
  now: number,
  counter: number,
  paused: boolean,
  stallMs: number,
): { state: StallState; stalled: boolean } {
  if (paused || counter !== state.counter) {
    return { state: { counter, changedAt: now }, stalled: false }
  }
  if (now - state.changedAt >= stallMs) {
    return { state: { counter, changedAt: now }, stalled: true }
  }
  return { state, stalled: false }
}
