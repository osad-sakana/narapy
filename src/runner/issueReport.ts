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

export function buildErrorIssueUrl({ errorType, raw }: ErrorIssueInput): string {
  const title = `[未翻訳エラー] ${errorType}`
  const body = [
    '## 元のエラー',
    '```',
    truncate(raw, RAW_MESSAGE_MAX_LENGTH),
    '```',
    '',
    '## 期待する日本語メッセージ',
    '',
    '## 再現コード（任意・手で貼ってください）',
    '',
  ].join('\n')

  const params = new URLSearchParams({ title, body })
  return `${ISSUE_BASE}?${params.toString()}`
}
