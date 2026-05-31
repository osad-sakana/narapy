import type { FileEntry, FileState } from './types'

const STORAGE_KEY = 'narapy_files_v1'

const DEFAULT_STATE: FileState = {
  files: [{ name: 'main.py', content: '' }],
  activeFile: 'main.py',
}

function loadFromStorage(): FileState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FileState
      if (Array.isArray(parsed.files) && parsed.files.length > 0 && typeof parsed.activeFile === 'string') {
        const hasActive = parsed.files.some(f => f.name === parsed.activeFile)
        return hasActive ? parsed : { ...parsed, activeFile: parsed.files[0].name }
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return { ...DEFAULT_STATE, files: [{ ...DEFAULT_STATE.files[0] }] }
}

function persist(state: FileState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

let state: FileState = loadFromStorage()

export function getFiles(): FileEntry[] {
  return state.files
}

export function getActiveFile(): string {
  return state.activeFile
}

export function getActiveContent(): string {
  return state.files.find(f => f.name === state.activeFile)?.content ?? ''
}

export function setActiveFile(name: string): void {
  if (!state.files.find(f => f.name === name)) return
  state = { ...state, activeFile: name }
  persist(state)
}

export function updateFileContent(name: string, content: string): void {
  const files = state.files.map(f => f.name === name ? { ...f, content } : f)
  state = { ...state, files }
  persist(state)
}

export function createFile(name: string, content = ''): boolean {
  if (state.files.find(f => f.name === name)) return false
  const files = [...state.files, { name, content }]
  state = { ...state, files }
  persist(state)
  return true
}

export function upsertFile(name: string, content: string): void {
  if (state.files.find(f => f.name === name)) {
    updateFileContent(name, content)
  } else {
    const files = [...state.files, { name, content }]
    state = { ...state, files }
    persist(state)
  }
}

export function deleteFile(name: string): boolean {
  if (state.files.length <= 1) return false
  const files = state.files.filter(f => f.name !== name)
  const activeFile = state.activeFile === name ? files[0].name : state.activeFile
  state = { files, activeFile }
  persist(state)
  return true
}

export function getAllFilesAsRecord(): Record<string, string> {
  return Object.fromEntries(state.files.map(f => [f.name, f.content]))
}
