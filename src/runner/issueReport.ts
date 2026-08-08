// GitHub Issue作成ページの標準クエリパラメータ（title / body）を使う。
// フロントエンド完結型のためリポジトリ情報を実行時に取得する手段がなくハードコードする。
const ISSUE_BASE = 'https://github.com/osad-sakana/narapy/issues/new'
const RAW_MESSAGE_MAX_LENGTH = 1000

export interface ErrorIssueInput {
  errorType: string
  raw: string
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n…（以下省略）`
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
  const body = [
    '## 元のエラー',
    '（実行結果のトレースバックです。入力したコードの一部が含まれる場合があります）',
    fence(truncate(raw, RAW_MESSAGE_MAX_LENGTH)),
    '',
    '## 期待する日本語メッセージ',
    '',
    '## 補足（任意）',
    '',
  ].join('\n')

  const params = new URLSearchParams({ title, body })
  return `${ISSUE_BASE}?${params.toString()}`
}
