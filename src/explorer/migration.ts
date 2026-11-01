import { MIGRATED_PROJECT_TITLE } from '../project/title'
import type { FileEntry, FileState, ProjectRecord } from './types'

export const LEGACY_LS_KEY = 'narapy_files_v1'

// activeFile がファイルに無い／テキストでないときは、最初のテキストファイルへ補正する
export function resolveActiveFile(files: FileEntry[], active: string | undefined, fallback: string): string {
  if (active && files.some(f => f.path === active && f.content.kind === 'text')) return active
  return files.find(f => f.content.kind === 'text')?.path ?? files[0]?.path ?? fallback
}

export function newProjectId(): string {
  return crypto.randomUUID()
}

export function toProjectRecord(state: FileState, title: string, now = Date.now()): ProjectRecord {
  return { ...state, id: newProjectId(), title, updatedAt: now }
}

// IndexedDB v1（単一プロジェクト）のスナップショットを 1 件のプロジェクトへ変換する。
// ファイルが空なら移行するものが無いので null。
export function migrateV1Snapshot(
  files: FileEntry[],
  activeFile: string | undefined,
  directories: string[] | undefined,
  now = Date.now(),
): ProjectRecord | null {
  if (files.length === 0) return null
  return toProjectRecord(
    {
      files,
      directories: (directories ?? []).map(path => ({ path })),
      activeFile: resolveActiveFile(files, activeFile, 'main.py'),
    },
    MIGRATED_PROJECT_TITLE,
    now,
  )
}

interface LegacyState {
  files?: Array<{ name?: unknown; content?: unknown }>
  activeFile?: unknown
}

// 旧 localStorage（narapy_files_v1）の JSON から移行する。壊れていれば null。
export function migrateLegacyLocalStorage(raw: string | null, now = Date.now()): ProjectRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LegacyState
    if (!Array.isArray(parsed.files)) return null
    const files: FileEntry[] = []
    for (const f of parsed.files) {
      if (typeof f?.name !== 'string' || typeof f?.content !== 'string') continue
      files.push({ path: f.name, content: { kind: 'text', data: f.content } })
    }
    const active = typeof parsed.activeFile === 'string' ? parsed.activeFile : undefined
    return migrateV1Snapshot(files, active, [], now)
  } catch {
    return null
  }
}
