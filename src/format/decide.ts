export interface ApplyContext {
  readonly sameModel: boolean
  readonly sentVersion: number
  readonly currentVersion: number
  readonly readOnly: boolean
  readonly path: string
  readonly before: string
  readonly after: string
}

export type ApplyDecision = 'apply' | 'stale' | 'skip' | 'unchanged'

// 整形結果をエディタへ反映してよいかの判定。
// 非同期で待つ間に編集・ファイル切替が起きた結果を適用すると入力が消えるため stale で捨てる。
export function decideApply(ctx: ApplyContext): ApplyDecision {
  if (!ctx.sameModel || ctx.sentVersion !== ctx.currentVersion) return 'stale'
  if (ctx.readOnly || !ctx.path.endsWith('.py')) return 'skip'
  if (ctx.before === ctx.after) return 'unchanged'
  return 'apply'
}
