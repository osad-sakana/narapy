import type { DirectoryEntry, FileContent, FileEntry, FileState } from './types'
import type { RunFile } from '../types'
import { loadState, saveState } from './persistence'
import { getAncestorDirs } from './paths'

const DEFAULT_STATE: FileState = {
  files: [{ path: 'main.py', content: { kind: 'text', data: '' } }],
  directories: [],
  activeFile: 'main.py',
}

let state: FileState = cloneDefault()
let initialized = false
let pendingWrite: Promise<void> = Promise.resolve()

function cloneDefault(): FileState {
  return {
    files: DEFAULT_STATE.files.map(f => ({
      path: f.path,
      content: { kind: 'text', data: '' },
    })),
    directories: [],
    activeFile: DEFAULT_STATE.activeFile,
  }
}

function persist(): void {
  const snapshot = state
  pendingWrite = pendingWrite
    .catch(() => undefined)
    .then(() => saveState(snapshot))
    .catch(err => {
      console.error('IndexedDB 永続化に失敗', err)
    })
}

export async function initStore(): Promise<void> {
  if (initialized) return
  state = await loadState(cloneDefault())
  initialized = true
}

export async function flushStore(): Promise<void> {
  await pendingWrite
}

export function getFiles(): FileEntry[] {
  return state.files
}

export function getDirectories(): DirectoryEntry[] {
  return state.directories
}

export function getActiveFile(): string {
  return state.activeFile
}

export function getActiveContent(): string {
  const entry = state.files.find(f => f.path === state.activeFile)
  if (!entry) return ''
  if (entry.content.kind === 'text') return entry.content.data
  return ''
}

export function getFile(path: string): FileEntry | undefined {
  return state.files.find(f => f.path === path)
}

export function setActiveFile(path: string): boolean {
  const entry = state.files.find(f => f.path === path)
  if (!entry || entry.content.kind !== 'text') return false
  if (state.activeFile === path) return true
  state = { ...state, activeFile: path }
  persist()
  return true
}

export function updateFileContent(path: string, data: string): void {
  const target = state.files.find(f => f.path === path)
  if (!target || target.content.kind !== 'text') return
  if (target.content.data === data) return
  const files = state.files.map(f => f.path === path
    ? { path, content: { kind: 'text' as const, data } }
    : f)
  state = { ...state, files }
  persist()
}

export function createTextFile(path: string, data = ''): boolean {
  if (state.files.find(f => f.path === path)) return false
  const files = [...state.files, { path, content: { kind: 'text' as const, data } }]
  state = { ...state, files }
  ensureAncestorDirsMutating(path)
  persist()
  return true
}

export function upsertFile(path: string, content: FileContent): void {
  const existing = state.files.findIndex(f => f.path === path)
  let files: FileEntry[]
  if (existing >= 0) {
    files = state.files.map((f, i) => i === existing ? { path, content } : f)
  } else {
    files = [...state.files, { path, content }]
  }
  state = { ...state, files }
  ensureAncestorDirsMutating(path)
  persist()
}

export function deleteFile(path: string): boolean {
  const target = state.files.find(f => f.path === path)
  if (!target) return false
  const textFiles = state.files.filter(f => f.content.kind === 'text')
  if (target.content.kind === 'text' && textFiles.length <= 1) return false

  const files = state.files.filter(f => f.path !== path)
  let activeFile = state.activeFile
  if (path === state.activeFile) {
    const next = files.find(f => f.content.kind === 'text')
    activeFile = next?.path ?? files[0]?.path ?? DEFAULT_STATE.activeFile
  }
  state = { ...state, files, activeFile }
  persist()
  return true
}

export function createDirectory(path: string): boolean {
  if (!path) return false
  if (state.directories.some(d => d.path === path)) return false
  const directories = [...state.directories, { path }]
  state = { ...state, directories }
  ensureAncestorDirsMutating(`${path}/_`)
  persist()
  return true
}

export function deleteDirectory(path: string): boolean {
  const prefix = `${path}/`
  const hasFiles = state.files.some(f => f.path === path || f.path.startsWith(prefix))
  const hasSubdirs = state.directories.some(d => d.path !== path && d.path.startsWith(prefix))
  if (hasFiles || hasSubdirs) return false
  const directories = state.directories.filter(d => d.path !== path)
  if (directories.length === state.directories.length) return false
  state = { ...state, directories }
  persist()
  return true
}

function ensureAncestorDirsMutating(path: string): void {
  const ancestors = getAncestorDirs(path)
  if (ancestors.length === 0) return
  const known = new Set(state.directories.map(d => d.path))
  const additions: DirectoryEntry[] = []
  for (const a of ancestors) {
    if (!known.has(a)) {
      additions.push({ path: a })
      known.add(a)
    }
  }
  if (additions.length > 0) {
    state = { ...state, directories: [...state.directories, ...additions] }
  }
}

export function getAllTextFilesAsRecord(): Record<string, string> {
  const record: Record<string, string> = {}
  for (const f of state.files) {
    if (f.content.kind === 'text') record[f.path] = f.content.data
  }
  return record
}

export function getAllFilesForRun(): { files: RunFile[]; directories: string[] } {
  const files: RunFile[] = state.files.map(f => f.content.kind === 'text'
    ? { kind: 'text', path: f.path, data: f.content.data }
    : { kind: 'binary', path: f.path, data: f.content.data })
  const directories = state.directories.map(d => d.path)
  return { files, directories }
}

export function loadProject(files: FileEntry[], directories: DirectoryEntry[], activeFile: string): void {
  const cloned = files.map(f => ({
    path: f.path,
    content: f.content.kind === 'text'
      ? { kind: 'text' as const, data: f.content.data }
      : { kind: 'binary' as const, data: f.content.data, mime: f.content.mime },
  }))
  const dirs = directories.map(d => ({ path: d.path }))
  const resolvedActive = cloned.find(f => f.path === activeFile && f.content.kind === 'text')
    ? activeFile
    : (cloned.find(f => f.content.kind === 'text')?.path ?? cloned[0]?.path ?? DEFAULT_STATE.activeFile)
  state = { files: cloned, directories: dirs, activeFile: resolvedActive }
  persist()
}

