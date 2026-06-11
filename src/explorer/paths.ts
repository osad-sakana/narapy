const PATH_SEGMENT_RE = /^[a-zA-Z0-9_.\-]+$/

export function normalizePath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .split('/')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '.')
    .join('/')
}

export function validatePath(raw: string): string | null {
  const path = normalizePath(raw)
  if (!path) return 'パスを入力してください'
  const segments = path.split('/')
  for (const seg of segments) {
    if (seg === '..') return '相対パス（..）は使えません'
    if (!PATH_SEGMENT_RE.test(seg)) {
      return `使用できない文字が含まれています: "${seg}"`
    }
  }
  return null
}

export function getDirname(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return ''
  return path.slice(0, idx)
}

export function getBasename(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return path
  return path.slice(idx + 1)
}

export function getAncestorDirs(path: string): string[] {
  const dir = getDirname(path)
  if (!dir) return []
  const parts = dir.split('/')
  const acc: string[] = []
  let cur = ''
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p
    acc.push(cur)
  }
  return acc
}

export function joinPath(...segments: string[]): string {
  return normalizePath(segments.join('/'))
}
