import type { DirectoryEntry, FileContent, FileEntry, FileState, ProjectRecord, ProjectSummary } from './types'
import type { RunFile } from '../types'
import { deleteProjectRecord, loadAll, saveCurrentId, saveProject } from './persistence'
import { newProjectId, resolveActiveFile } from './migration'
import { DEFAULT_PROJECT_TITLE, normalizeTitle } from '../project/title'
import { getAncestorDirs } from './paths'
import { planMove, type MovePlan, type MoveSource } from './move'

const DEFAULT_STATE: FileState = {
  files: [{ path: 'main.py', content: { kind: 'text', data: '' } }],
  directories: [],
  activeFile: 'main.py',
}

let state: FileState = cloneDefault()
// initStore() 前でもストア操作が成立するよう、メモリ上に既定の現在プロジェクトを 1 件持つ
let projects: ProjectRecord[] = [newDefaultRecord()]
let currentId: string = projects[0].id
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

function newDefaultRecord(title = DEFAULT_PROJECT_TITLE, now = Date.now()): ProjectRecord {
  return { ...cloneDefault(), id: newProjectId(), title, createdAt: now, updatedAt: now }
}

function enqueue(task: () => Promise<void>): void {
  pendingWrite = pendingWrite
    .catch(() => undefined)
    .then(task)
    .catch(err => {
      console.error('IndexedDB 永続化に失敗', err)
    })
}

function currentTitle(): string {
  return projects.find(p => p.id === currentId)?.title ?? DEFAULT_PROJECT_TITLE
}

// 呼ばれた時点のスナップショットを書き込みキューに積む（キュー消化時に別プロジェクトへ
// 切り替わっていても、元のプロジェクトへ書き込めるようにするため）
function persist(): void {
  const existing = projects.find(p => p.id === currentId)
  const record: ProjectRecord = {
    ...state,
    id: currentId,
    title: currentTitle(),
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
  projects = projects.map(p => p.id === currentId ? record : p)
  enqueue(() => saveProject(record))
}

// 新規プロジェクト作成(issue #58)で使う初期状態。cloneDefault() を経由させることで
// 起動時のデフォルト状態と定義がずれないようにする。
export function createDefaultProject(): FileState {
  return cloneDefault()
}

export async function initStore(): Promise<void> {
  if (initialized) return
  const loaded = await loadAll(() => newDefaultRecord())
  projects = loaded.projects
  currentId = loaded.currentId
  const current = projects.find(p => p.id === currentId)!
  state = { files: current.files, directories: current.directories, activeFile: current.activeFile }
  initialized = true
}

export async function flushStore(): Promise<void> {
  await pendingWrite
}

export function listProjects(): ProjectSummary[] {
  return projects.map(p => ({ id: p.id, title: p.title }))
}

export function getCurrentProject(): ProjectSummary {
  return { id: currentId, title: currentTitle() }
}

function cloneState(input: FileState): FileState {
  const files = input.files.map(f => ({
    path: f.path,
    content: f.content.kind === 'text'
      ? { kind: 'text' as const, data: f.content.data }
      : { kind: 'binary' as const, data: f.content.data, mime: f.content.mime },
  }))
  return {
    files,
    directories: input.directories.map(d => ({ path: d.path })),
    activeFile: resolveActiveFile(files, input.activeFile, DEFAULT_STATE.activeFile),
  }
}

// 新しいプロジェクトを作って現在のプロジェクトにする。input が無ければ初期状態(main.py 1件)。
export function createProject(title: string, input?: FileState): ProjectSummary {
  const now = Date.now()
  const record: ProjectRecord = {
    ...cloneState(input ?? cloneDefault()),
    id: newProjectId(),
    title: normalizeTitle(title),
    createdAt: now,
    updatedAt: now,
  }
  projects = [...projects, record]
  currentId = record.id
  state = { files: record.files, directories: record.directories, activeFile: record.activeFile }
  enqueue(() => saveProject(record))
  enqueue(() => saveCurrentId(record.id))
  return { id: record.id, title: record.title }
}

// 切替前の退避は不要（編集のたびに persist() 済み、issue #48）
export function switchProject(id: string): boolean {
  const target = projects.find(p => p.id === id)
  if (!target) return false
  if (id === currentId) return true
  currentId = id
  state = { files: target.files, directories: target.directories, activeFile: target.activeFile }
  enqueue(() => saveCurrentId(id))
  return true
}

export function renameProject(title: string): ProjectSummary {
  const normalized = normalizeTitle(title)
  projects = projects.map(p => p.id === currentId ? { ...p, title: normalized } : p)
  persist()
  return getCurrentProject()
}

// 最後の 1 件は削除できない。現在のプロジェクトを消したときは、最後に更新したものへ切り替える。
export function deleteProject(id: string): boolean {
  if (projects.length <= 1) return false
  const target = projects.find(p => p.id === id)
  if (!target) return false
  const remaining = projects.filter(p => p.id !== id)
  projects = remaining
  enqueue(() => deleteProjectRecord(id))
  if (id === currentId) {
    const next = remaining.reduce((latest, p) => (p.updatedAt > latest.updatedAt ? p : latest))
    currentId = next.id
    state = { files: next.files, directories: next.directories, activeFile: next.activeFile }
    enqueue(() => saveCurrentId(next.id))
  }
  return true
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

// ファイル・フォルダを destDir（ルートは空文字）へ移動する。失敗時は状態を変えない。
// 内容は共有したままパスだけを付け替え、アクティブファイルが移動対象なら追従させる。
export function moveEntry(source: MoveSource, destDir: string): MovePlan {
  const plan = planMove(
    { files: state.files.map(f => f.path), directories: state.directories.map(d => d.path) },
    source,
    destDir,
  )
  if (!plan.ok) return plan

  const fileTo = new Map(plan.fileMoves.map(m => [m.from, m.to]))
  const dirTo = new Map(plan.dirMoves.map(m => [m.from, m.to]))
  state = {
    files: state.files.map(f => fileTo.has(f.path) ? { path: fileTo.get(f.path)!, content: f.content } : f),
    directories: state.directories.map(d => dirTo.has(d.path) ? { path: dirTo.get(d.path)! } : d),
    activeFile: fileTo.get(state.activeFile) ?? state.activeFile,
  }
  if (destDir) ensureAncestorDirsMutating(`${destDir}/_`)
  persist()
  return plan
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

// URLからの初期読み込み(issue #32)で、既存の作業内容を無断で上書きしないための判定
export function hasUserContent(): boolean {
  if (state.directories.length > 0) return true
  if (state.files.length !== 1) return true
  const file = state.files[0]
  return !(file.path === 'main.py' && file.content.kind === 'text' && file.content.data === '')
}

export function loadProject(files: FileEntry[], directories: DirectoryEntry[], activeFile: string): void {
  state = cloneState({ files, directories, activeFile })
  persist()
}
