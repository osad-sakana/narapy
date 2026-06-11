import type { FileKind } from './types'

const TEXT_EXT = new Set(['.py', '.csv', '.txt', '.json', '.md'])
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export function getExtension(path: string): string {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot).toLowerCase()
}

export function detectFileKind(path: string): FileKind | null {
  const ext = getExtension(path)
  if (TEXT_EXT.has(ext)) return 'text'
  if (BINARY_EXT.has(ext)) return 'binary'
  return null
}

export function isTextPath(path: string): boolean {
  return detectFileKind(path) === 'text'
}

export function isBinaryPath(path: string): boolean {
  return detectFileKind(path) === 'binary'
}

export function isPythonPath(path: string): boolean {
  return getExtension(path) === '.py'
}

export function guessMime(path: string): string {
  const ext = getExtension(path)
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export const SUPPORTED_TEXT_EXT = [...TEXT_EXT]
export const SUPPORTED_BINARY_EXT = [...BINARY_EXT]
