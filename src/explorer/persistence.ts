import { LEGACY_LS_KEY, migrateLegacyLocalStorage, migrateV1Snapshot } from './migration'
import type { FileEntry, ProjectRecord } from './types'

const DB_NAME = 'narapy'
const DB_VERSION = 2
const STORE_PROJECTS = 'projects'
const STORE_META = 'meta'
const META_KEY_CURRENT = 'currentProjectId'
// v1 (単一プロジェクト) のレイアウト。v2 への移行でのみ参照する
const V1_STORE_FILES = 'files'
const V1_META_ACTIVE = 'activeFile'
const V1_META_DIRS = 'directories'

interface V1StoredFile {
  path: string
  kind: 'text' | 'binary'
  text?: string
  bin?: Uint8Array
  mime?: string
}

export interface LoadedProjects {
  projects: ProjectRecord[]
  currentId: string
}

function fromV1Stored(stored: V1StoredFile): FileEntry {
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

// v1 → v2。アップグレードのトランザクション内で完結させる。ここでは IDB 以外の Promise を
// await しないこと（トランザクションが自動コミットされてしまう）。途中で例外が出れば
// アップグレード全体が中断され、DB は v1 のままデータも残る。
function upgradeToV2(db: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META)
  if (oldVersion < 2) db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
  if (oldVersion !== 1 || !db.objectStoreNames.contains(V1_STORE_FILES)) return

  const meta = tx.objectStore(STORE_META)
  const filesReq = tx.objectStore(V1_STORE_FILES).getAll() as IDBRequest<V1StoredFile[]>
  const activeReq = meta.get(V1_META_ACTIVE) as IDBRequest<string | undefined>
  const dirsReq = meta.get(V1_META_DIRS) as IDBRequest<string[] | undefined>

  let pending = 3
  const onRead = (): void => {
    pending -= 1
    if (pending > 0) return
    const record = migrateV1Snapshot(filesReq.result.map(fromV1Stored), activeReq.result, dirsReq.result)
    if (!record) {
      db.deleteObjectStore(V1_STORE_FILES)
      return
    }
    const putReq = tx.objectStore(STORE_PROJECTS).put(record)
    putReq.onsuccess = () => {
      meta.put(record.id, META_KEY_CURRENT)
      meta.delete(V1_META_ACTIVE)
      meta.delete(V1_META_DIRS)
      // コピーの成功後にだけ v1 のデータを消す
      db.deleteObjectStore(V1_STORE_FILES)
    }
  }
  for (const req of [filesReq, activeReq, dirsReq]) req.onsuccess = onRead
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (ev) => {
      const tx = req.transaction
      if (!tx) return
      upgradeToV2(req.result, tx, ev.oldVersion)
    }
    req.onsuccess = () => {
      const db = req.result
      // 別タブが新しいバージョンへ上げられるよう、接続を残さない
      db.onversionchange = () => db.close()
      resolve(db)
    }
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

function readLegacyLocalStorage(): ProjectRecord | null {
  try {
    return migrateLegacyLocalStorage(localStorage.getItem(LEGACY_LS_KEY))
  } catch {
    return null
  }
}

function clearLegacyStorage(): void {
  try { localStorage.removeItem(LEGACY_LS_KEY) } catch { /* ignore */ }
}

function pickCurrentId(projects: ProjectRecord[], saved: string | undefined): string {
  if (saved && projects.some(p => p.id === saved)) return saved
  return projects.reduce((latest, p) => (p.updatedAt > latest.updatedAt ? p : latest)).id
}

export async function loadAll(createDefault: () => ProjectRecord): Promise<LoadedProjects> {
  const fallback = (): LoadedProjects => {
    const record = createDefault()
    return { projects: [record], currentId: record.id }
  }

  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return fallback()
  }

  try {
    const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readonly')
    const projectsReq = tx.objectStore(STORE_PROJECTS).getAll() as IDBRequest<ProjectRecord[]>
    const currentReq = tx.objectStore(STORE_META).get(META_KEY_CURRENT) as IDBRequest<string | undefined>
    const [projects, saved] = await Promise.all([reqToPromise(projectsReq), reqToPromise(currentReq)])
    await awaitTx(tx)

    if (projects.length > 0) {
      const ordered = [...projects].sort((a, b) => a.createdAt - b.createdAt)
      return { projects: ordered, currentId: pickCurrentId(ordered, saved) }
    }

    const migrated = readLegacyLocalStorage()
    const first = migrated ?? createDefault()
    await saveProject(first)
    await saveCurrentId(first.id)
    if (migrated) clearLegacyStorage()
    return { projects: [first], currentId: first.id }
  } catch {
    return fallback()
  } finally {
    db.close()
  }
}

async function withWrite(run: (tx: IDBTransaction) => void): Promise<void> {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  try {
    const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readwrite')
    run(tx)
    await awaitTx(tx)
  } finally {
    db.close()
  }
}

export function saveProject(record: ProjectRecord): Promise<void> {
  return withWrite(tx => { tx.objectStore(STORE_PROJECTS).put(record) })
}

export function deleteProjectRecord(id: string): Promise<void> {
  return withWrite(tx => { tx.objectStore(STORE_PROJECTS).delete(id) })
}

export function saveCurrentId(id: string): Promise<void> {
  return withWrite(tx => { tx.objectStore(STORE_META).put(id, META_KEY_CURRENT) })
}
