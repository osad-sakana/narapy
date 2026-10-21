import { getExtension, isBinaryPath } from './fileKind'

export interface FileBadge {
  label: string
  // Tailwind の文字色クラス
  colorClass: string
}

const KNOWN: Readonly<Record<string, FileBadge>> = {
  '.py': { label: 'PY', colorClass: 'text-accent' },
  '.csv': { label: 'CSV', colorClass: 'text-success' },
  '.json': { label: 'JSON', colorClass: 'text-warn' },
  '.md': { label: 'MD', colorClass: 'text-muted' },
  '.txt': { label: 'TXT', colorClass: 'text-muted' },
}

// エクスプローラーでファイル名の前に出す、種類を示す小さなバッジ。
// 画像（バイナリ）は専用のアイコンを使うため null。
export function fileBadge(path: string): FileBadge | null {
  if (isBinaryPath(path)) return null
  const ext = getExtension(path)
  if (ext === '') return null
  if (Object.hasOwn(KNOWN, ext)) return KNOWN[ext]
  return { label: ext.slice(1, 4).toUpperCase(), colorClass: 'text-muted' }
}
