// 整形結果。ok 以外は「コードを書き換えない」ケース。
export type FormatResult =
  | { status: 'ok'; code: string }
  | { status: 'syntax_error'; line: number; msg: string }
  | { status: 'rejected' }
  | { status: 'failed' }
  | { status: 'unchanged' }
  | { status: 'unavailable' }
  | { status: 'too_large' }
  | { status: 'timeout' }

// Worker 由来の値は信頼せず、メインスレッド側でも形を検証する
export function parseFormatResult(value: unknown): FormatResult | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  switch (v.status) {
    case 'ok':
      return typeof v.code === 'string' ? { status: 'ok', code: v.code } : null
    case 'syntax_error':
      return typeof v.line === 'number' && Number.isInteger(v.line) && typeof v.msg === 'string'
        ? { status: 'syntax_error', line: v.line, msg: v.msg }
        : null
    case 'rejected':
      return { status: 'rejected' }
    case 'failed':
      return { status: 'failed' }
    default:
      return null
  }
}

export function formatMessage(result: FormatResult): string | null {
  switch (result.status) {
    case 'ok':
      return null
    case 'unchanged':
      return '整形: 変更はありません'
    case 'syntax_error':
      return `⚠️ ${result.line}行目に文法エラーがあるため整形できません: ${result.msg}`
    case 'rejected':
      return '⚠️ 整形すると動作が変わる可能性があるため、整形しませんでした'
    case 'failed':
      return '⚠️ 整形中にエラーが発生したため、整形しませんでした'
    case 'too_large':
      return '⚠️ コードが大きすぎるため整形できません'
    case 'timeout':
      return '⚠️ 整形がタイムアウトしました。もう一度お試しください'
    case 'unavailable':
      return '⚠️ 整形の準備ができませんでした。ネットワーク接続を確認してもう一度お試しください'
  }
}
