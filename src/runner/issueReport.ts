// GitHub Issue作成ページの標準クエリパラメータ（title / body）を使う。
// フロントエンド完結型のためリポジトリ情報を実行時に取得する手段がなくハードコードする。
const ISSUE_BASE = 'https://github.com/osad-sakana/narapy/issues/new'
const RAW_MESSAGE_MAX_LENGTH = 1000
// URL全体の長さ（GitHub/プロキシ側の実用上限）を超えないよう、raw部分は
// パーセントエンコード後の文字数でも上限を設ける（日本語主体のトレースバックは1文字が最大9文字に膨れるため）
const RAW_MESSAGE_MAX_ENCODED_LENGTH = 4000

export interface ErrorIssueInput {
  errorType: string
  raw: string
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n…（以下省略）`
}

function truncateByEncodedLength(text: string, maxEncodedLength: number): string {
  if (encodeURIComponent(text).length <= maxEncodedLength) return text

  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (encodeURIComponent(text.slice(0, mid)).length <= maxEncodedLength) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return `${text.slice(0, lo)}\n…（以下省略）`
}

// raw に ``` が含まれているとMarkdownのコードフェンスが途中で閉じてしまうため、
// raw中の最長バッククォート連続より長いフェンスで囲む
function fence(text: string): string {
  const longestBacktickRun = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length))
  const bar = '`'.repeat(Math.max(3, longestBacktickRun + 1))
  return `${bar}\n${text}\n${bar}`
}

export function buildErrorIssueUrl({ errorType, raw }: ErrorIssueInput): string {
  const title = `[未翻訳エラー] ${errorType}`
  const truncatedRaw = truncateByEncodedLength(
    truncate(raw, RAW_MESSAGE_MAX_LENGTH),
    RAW_MESSAGE_MAX_ENCODED_LENGTH,
  )
  const body = [
    '## 元のエラー',
    '（実行結果のトレースバックです。入力したコードの一部が含まれる場合があります）',
    fence(truncatedRaw),
    '',
    '## 期待する日本語メッセージ',
    '',
    '## 補足（任意）',
    '',
  ].join('\n')

  const params = new URLSearchParams({ title, body })
  return `${ISSUE_BASE}?${params.toString()}`
}
