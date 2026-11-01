export const DEFAULT_PROJECT_TITLE = '無題のプロジェクト'
export const SHARED_PROJECT_TITLE = '共有されたプロジェクト'
export const MIGRATED_PROJECT_TITLE = 'マイプロジェクト'
const MAX_TITLE_LENGTH = 50

// 空白だけ・空のタイトルは既定名に置き換え、長すぎるタイトルは切り詰める
export function normalizeTitle(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return DEFAULT_PROJECT_TITLE
  return Array.from(trimmed).slice(0, MAX_TITLE_LENGTH).join('')
}

// ダウンロードするファイル名に使えない文字を置き換える
export function toSafeFileName(title: string): string {
  // eslint-disable-next-line no-control-regex
  const replaced = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim()
  return replaced === '' ? DEFAULT_PROJECT_TITLE : replaced
}

// 取り込んだファイル名（my.project.narapy）から拡張子を除いたタイトルを作る
export function titleFromFileName(fileName: string): string {
  return normalizeTitle(fileName.replace(/\.(narapy|exercise)$/i, ''))
}
