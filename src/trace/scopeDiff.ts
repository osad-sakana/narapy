import type { TraceStep, TraceVar } from './types'

// steps[0..index-1] を後方に探索し、指定した step と同じスコープ（funcName+depth）を
// 持つ直近のステップを返す。関数呼び出しをまたぐと該当スコープのステップが連続しない
// ため、単純な「直前のステップ」との比較だけでは検出できない（関数から戻った直後の
// モジュール変数が、間に挟まっていた関数呼び出しの分だけ全て「新規」に見えてしまう）。
// より浅いフレームまで遡ったら探索を打ち切る（＝別の呼び出しの中に入ってしまうため）。
export function findPreviousStepInScope(
  steps: TraceStep[],
  index: number,
  step: TraceStep,
): TraceStep | null {
  for (let i = index - 1; i >= 0; i--) {
    const candidate = steps[i]
    if (candidate.funcName === step.funcName && candidate.depth === step.depth) {
      return candidate
    }
    if (candidate.depth < step.depth) return null
  }
  return null
}

// グローバル変数はスコープに関わらず単一の名前空間なので、直近でグローバルの
// スナップショットを持っていたステップ（globalsが記録されている最後のステップ）
// と比較すればよい。ただしモジュール直下（depth 0）のステップは locals がそのまま
// globals と同一のため globals フィールドが null になる（traceModule.ts参照）。
// そこまで遡った場合は locals をグローバルのスナップショットとして扱う
// （これを省くと、関数に初めて入った瞬間に全グローバル変数が「新規」表示になる）。
export function findPreviousGlobalsSnapshot(steps: TraceStep[], index: number): TraceVar[] | null {
  for (let i = index - 1; i >= 0; i--) {
    if (steps[i].globals) return steps[i].globals
    if (steps[i].depth === 0) return steps[i].locals
  }
  return null
}
