export type MissingCallKind = 'expr' | 'if' | 'while' | 'assert'

export interface MissingCallWarning {
  readonly name: string
  readonly kind: MissingCallKind
  readonly line: number
  readonly col: number
  readonly endCol: number
}

// ok 以外は警告を出せない（または出さない）ケース。superseded は後続の要求に置き換わった古い要求で、
// 結果として何も反映しない
export type LintResult =
  | { status: 'ok'; warnings: readonly MissingCallWarning[] }
  | { status: 'syntax_error' }
  | { status: 'failed' }
  | { status: 'unavailable' }
  | { status: 'too_large' }
  | { status: 'timeout' }
  | { status: 'superseded' }

const KINDS: readonly string[] = ['expr', 'if', 'while', 'assert']

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function parseWarning(value: unknown): MissingCallWarning | null {
  if (typeof value !== 'object' || value === null) return null
  const w = value as Record<string, unknown>
  if (typeof w.name !== 'string' || typeof w.kind !== 'string' || !KINDS.includes(w.kind)) return null
  if (!isPositiveInt(w.line) || !isPositiveInt(w.col) || !isPositiveInt(w.endCol)) return null
  return { name: w.name, kind: w.kind as MissingCallKind, line: w.line, col: w.col, endCol: w.endCol }
}

// Worker 由来の値は信頼せず、メインスレッド側でも形を検証する
export function parseLintResult(value: unknown): LintResult | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  switch (v.status) {
    case 'ok': {
      if (!Array.isArray(v.warnings)) return null
      const warnings = v.warnings.map(parseWarning)
      return warnings.every((w): w is MissingCallWarning => w !== null) ? { status: 'ok', warnings } : null
    }
    case 'syntax_error':
      return { status: 'syntax_error' }
    case 'failed':
      return { status: 'failed' }
    default:
      return null
  }
}

// マーカーと実行ログで同じ文言を使う
export function buildMessage(w: MissingCallWarning): string {
  if (w.kind === 'expr') {
    return `\`${w.name}\` の後ろに \`()\` がありません。\`${w.name}()\` のように \`()\` をつけて呼び出します`
  }
  return `\`${w.kind}\` の条件が関数 \`${w.name}\` そのものです。関数は常に真として扱われます。\`${w.name}()\` のように \`()\` をつけて呼び出し、結果を使います`
}

export function toLogLine(w: MissingCallWarning): string {
  return `[警告] ${w.line}行目: ${buildMessage(w)}`
}
