import type { FileEntry, FileState } from './types'

const DB_NAME = 'narapy'
const DB_VERSION = 1
const STORE_FILES = 'files'
const STORE_META = 'meta'
const META_KEY_ACTIVE = 'activeFile'
const META_KEY_DIRS = 'directories'
const LEGACY_LS_KEY = 'narapy_files_v1'

interface StoredFile {
  path: string
  kind: 'text' | 'binary'
  text?: string
  bin?: Uint8Array
  mime?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'path' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function toStored(entry: FileEntry): StoredFile {
  if (entry.content.kind === 'text') {
    return { path: entry.path, kind: 'text', text: entry.content.data }
  }
  return {
    path: entry.path,
    kind: 'binary',
    bin: entry.content.data,
    mime: entry.content.mime,
  }
}

function fromStored(stored: StoredFile): FileEntry {
  if (stored.kind === 'text') {
    return { path: stored.path, content: { kind: 'text', data: stored.text ?? '' } }
  }
  return {
    path: stored.path,
    content: {
      kind: 'binary',
      data: stored.bin ?? new Uint8Array(),
      mime: stored.mime ?? 'application/octet-stream',
    },
  }
}

interface LegacyState {
  files?: Array<{ name?: unknown; content?: unknown }>
  activeFile?: unknown
}

function tryMigrateFromLocalStorage(): FileState | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LegacyState
    if (!Array.isArray(parsed.files) || parsed.files.length === 0) return null
    const files: FileEntry[] = []
    for (const f of parsed.files) {
      if (typeof f?.name !== 'string' || typeof f?.content !== 'string') continue
      files.push({
        path: f.name,
        content: { kind: 'text', data: f.content },
      })
    }
    if (files.length === 0) return null
    const activeFile = typeof parsed.activeFile === 'string' && files.some(f => f.path === parsed.activeFile)
      ? parsed.activeFile
      : files[0].path
    return { files, directories: [], activeFile }
  } catch {
    return null
  }
}

function clearLegacyStorage(): void {
  try { localStorage.removeItem(LEGACY_LS_KEY) } catch { /* ignore */ }
}

export async function loadState(defaultState: FileState): Promise<FileState> {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return defaultState
  }

  const tx = db.transaction([STORE_FILES, STORE_META], 'readonly')
  const filesReq = tx.objectStore(STORE_FILES).getAll() as IDBRequest<StoredFile[]>
  const activeReq = tx.objectStore(STORE_META).get(META_KEY_ACTIVE) as IDBRequest<string | undefined>
  const dirsReq = tx.objectStore(STORE_META).get(META_KEY_DIRS) as IDBRequest<string[] | undefined>

  try {
    const [stored, active, dirs] = await Promise.all([
      reqToPromise(filesReq),
      reqToPromise(activeReq),
      reqToPromise(dirsReq),
    ])
    await awaitTx(tx)

    if (stored.length === 0) {
      const migrated = tryMigrateFromLocalStorage()
      if (migrated) {
        await saveState(migrated)
        clearLegacyStorage()
        return migrated
      }
      await saveState(defaultState)
      return defaultState
    }

    const files = stored.map(fromStored)
    const directories = (dirs ?? []).map(path => ({ path }))
    const activeFile = active && files.some(f => f.path === active)
      ? active
      : (files.find(f => f.content.kind === 'text')?.path ?? files[0]?.path ?? defaultState.activeFile)
    return { files, directories, activeFile }
  } finally {
    db.close()
  }
}

export async function saveState(state: FileState): Promise<void> {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite')
  const filesStore = tx.objectStore(STORE_FILES)
  const metaStore = tx.objectStore(STORE_META)

  filesStore.clear()
  for (const entry of state.files) {
    filesStore.put(toStored(entry))
  }
  metaStore.put(state.activeFile, META_KEY_ACTIVE)
  metaStore.put(state.directories.map(d => d.path), META_KEY_DIRS)

  try {
    await awaitTx(tx)
  } finally {
    db.close()
  }
}
