import type { TraceVar } from './types'

export type VarChangeKind = 'added' | 'changed' | 'unchanged'

export interface VarWithChange extends TraceVar {
  change: VarChangeKind
}

// 直前のステップの変数一覧と比較し、追加・変更・不変を判定する。
// previous が null の場合（スコープに入った直後など）は全変数を added とみなす。
// 値の比較は _safe_repr() 済みの文字列同士の一致で行うため、同じ repr を持つ
// 別オブジェクト（例: 別の空リスト同士）は unchanged として扱われる。
export function diffVars(previous: TraceVar[] | null, current: TraceVar[]): VarWithChange[] {
  const previousValues = new Map(previous?.map(v => [v.name, v.value]) ?? [])
  return current.map((v) => {
    if (!previousValues.has(v.name)) return { ...v, change: 'added' }
    if (previousValues.get(v.name) !== v.value) return { ...v, change: 'changed' }
    return { ...v, change: 'unchanged' }
  })
}
