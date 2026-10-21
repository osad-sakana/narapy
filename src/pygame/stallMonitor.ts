export interface StallState {
  counter: number
  changedAt: number
}

export const INITIAL_STALL_STATE: StallState = { counter: -1, changedAt: 0 }

// メインスレッドの心拍（counter）が進まない時間を見て、固まったか判定する純粋関数。
// タブ非表示中はブラウザがタイマーを最大 1 分に 1 回へ間引くため、閾値を長く（hiddenStallMs）する。
// 計測を止めてしまうと、非表示中に固まったときに「表示に戻った」通知を処理できず永久に復帰できない。
export function nextStallState(
  state: StallState,
  now: number,
  counter: number,
  hidden: boolean,
  stallMs: number,
  hiddenStallMs: number,
): { state: StallState; stalled: boolean } {
  if (counter !== state.counter) {
    return { state: { counter, changedAt: now }, stalled: false }
  }
  if (now - state.changedAt >= (hidden ? hiddenStallMs : stallMs)) {
    return { state: { counter, changedAt: now }, stalled: true }
  }
  return { state, stalled: false }
}
