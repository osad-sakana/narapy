import type { RawCompletion } from './completionMeta'

const USER_MODULE = '__main__'
const BUILTINS_MODULE = 'builtins'

// 「どこで作られたか」を返す。ユーザーコードは定義行、それ以外は完全名（random.randint 等）
export function describeOrigin(raw: RawCompletion): string {
  if (raw.type === 'keyword' || raw.type === 'param') return ''
  if (raw.module === USER_MODULE) {
    // import が解決できない名前（pygame 等）は定義行ではなく import 元を示す
    if (raw.fullName !== '' && !raw.fullName.startsWith(`${USER_MODULE}.`)) return raw.fullName
    return raw.line > 0 ? `${raw.line}行目で定義` : ''
  }
  if (raw.module === BUILTINS_MODULE) return '組み込み'
  return raw.fullName
}
