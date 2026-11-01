import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { deleteProjectRecord, loadAll, saveCurrentId, saveProject } from './persistence'
import type { ProjectRecord } from './types'

const rec = (id: string, title: string, updatedAt: number): ProjectRecord => ({
  id,
  title,
  createdAt: updatedAt,
  updatedAt,
  files: [{ path: 'main.py', content: { kind: 'text', data: title } }],
  directories: [],
  activeFile: 'main.py',
})

const fresh = () => rec('default', 'default', 0)

function openV1(populate: (db: IDBDatabase) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('narapy', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('files', { keyPath: 'path' })
      req.result.createObjectStore('meta')
    }
    req.onsuccess = () => populate(req.result).then(() => { req.result.close(); resolve() }, reject)
    req.onerror = () => reject(req.error)
  })
}

function stubLocalStorage(): Map<string, string> {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  })
  return map
}

let ls: Map<string, string>

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  ls = stubLocalStorage()
})

describe('persistence v2', () => {
  it('新規インストールでは既定プロジェクトを作って保存する', async () => {
    const first = await loadAll(fresh)
    expect(first.projects.map(p => p.id)).toEqual(['default'])
    const again = await loadAll(() => rec('other', 'other', 0))
    expect(again.projects.map(p => p.id)).toEqual(['default'])
  })

  it('保存・現在ID・削除が往復する', async () => {
    await loadAll(fresh)
    await saveProject(rec('a', 'A', 10))
    await saveProject(rec('b', 'B', 20))
    await saveCurrentId('a')
    const loaded = await loadAll(fresh)
    expect(loaded.projects.map(p => p.id).sort()).toEqual(['a', 'b', 'default'])
    expect(loaded.currentId).toBe('a')

    await deleteProjectRecord('a')
    const after = await loadAll(fresh)
    expect(after.projects.map(p => p.id).sort()).toEqual(['b', 'default'])
    expect(after.currentId).toBe('b')
  })

  it('v1 のデータを「マイプロジェクト」へ移行し、バイナリも保つ', async () => {
    await openV1(async (db) => {
      const tx = db.transaction(['files', 'meta'], 'readwrite')
      tx.objectStore('files').put({ path: 'a.py', kind: 'text', text: 'print(1)' })
      tx.objectStore('files').put({ path: 'd/i.png', kind: 'binary', bin: new Uint8Array([1, 2, 3]), mime: 'image/png' })
      tx.objectStore('meta').put('a.py', 'activeFile')
      tx.objectStore('meta').put(['d'], 'directories')
      await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    })

    const loaded = await loadAll(fresh)
    expect(loaded.projects).toHaveLength(1)
    const p = loaded.projects[0]
    expect(p.title).toBe('マイプロジェクト')
    expect(p.activeFile).toBe('a.py')
    expect(p.directories).toEqual([{ path: 'd' }])
    const png = p.files.find(f => f.path === 'd/i.png')
    expect(png?.content.kind === 'binary' && Array.from(png.content.data)).toEqual([1, 2, 3])
    expect(p.files.find(f => f.path === 'a.py')?.content).toEqual({ kind: 'text', data: 'print(1)' })
    expect(loaded.currentId).toBe(p.id)
  })

  it('v1 が空なら既定プロジェクトになる', async () => {
    await openV1(async () => undefined)
    const loaded = await loadAll(fresh)
    expect(loaded.projects.map(p => p.id)).toEqual(['default'])
  })

  it('旧 localStorage から移行して削除する', async () => {
    ls.set('narapy_files_v1', JSON.stringify({ files: [{ name: 'x.py', content: 'hi' }], activeFile: 'x.py' }))
    const loaded = await loadAll(fresh)
    expect(loaded.projects[0].files[0].path).toBe('x.py')
    expect(ls.has('narapy_files_v1')).toBe(false)
  })
})
