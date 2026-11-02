export interface LintApplyContext {
  readonly sameModel: boolean
  readonly sentVersion: number
  readonly currentVersion: number
  readonly suppressed: boolean
  readonly isPython: boolean
}

export type LintApplyDecision = 'apply' | 'stale' | 'clear'

// 非同期で待つ間に編集・ファイル切替・講師モードの切替が起きた結果を適用すると、
// 古い波線が残る・消したはずの波線が復活するため、条件を満たさない結果は捨てる
export function decideLintApply(ctx: LintApplyContext): LintApplyDecision {
  if (!ctx.sameModel || ctx.sentVersion !== ctx.currentVersion) return 'stale'
  if (ctx.suppressed || !ctx.isPython) return 'clear'
  return 'apply'
}
