import { describe, expect, it } from 'vitest'
import { migrateLegacyLocalStorage, migrateV1Snapshot, resolveActiveFile } from './migration'
import type { FileEntry } from './types'

const text = (path: string, data = ''): FileEntry => ({ path, content: { kind: 'text', data } })
const bin = (path: string): FileEntry => ({ path, content: { kind: 'binary', data: new Uint8Array([1]), mime: 'image/png' } })

describe('resolveActiveFile', () => {
  it('有効な activeFile はそのまま', () => {
    expect(resolveActiveFile([text('a.py'), text('b.py')], 'b.py', 'x')).toBe('b.py')
  })
  it('存在しない・バイナリなら最初のテキストへ', () => {
    expect(resolveActiveFile([bin('i.png'), text('a.py')], 'i.png', 'x')).toBe('a.py')
    expect(resolveActiveFile([text('a.py')], 'zz.py', 'x')).toBe('a.py')
  })
  it('テキストが無ければ先頭ファイル、ファイルも無ければ fallback', () => {
    expect(resolveActiveFile([bin('i.png')], undefined, 'x')).toBe('i.png')
    expect(resolveActiveFile([], undefined, 'x')).toBe('x')
  })
})

describe('migrateV1Snapshot', () => {
  it('ファイルが空なら null', () => {
    expect(migrateV1Snapshot([], undefined, undefined)).toBeNull()
  })
  it('1 件のプロジェクトへ変換する', () => {
    const files = [text('main.py', 'print(1)'), bin('i.png')]
    const rec = migrateV1Snapshot(files, 'main.py', ['d'], 123)
    expect(rec?.title).toBe('マイプロジェクト')
    expect(rec?.files).toBe(files)
    expect(rec?.directories).toEqual([{ path: 'd' }])
    expect(rec?.activeFile).toBe('main.py')
    expect(rec?.updatedAt).toBe(123)
    expect(rec?.id).toBeTruthy()
  })
})

describe('migrateLegacyLocalStorage', () => {
  it('旧形式を変換する', () => {
    const raw = JSON.stringify({ files: [{ name: 'a.py', content: 'x' }], activeFile: 'a.py' })
    const rec = migrateLegacyLocalStorage(raw)
    expect(rec?.files).toEqual([text('a.py', 'x')])
  })
  it('null・壊れた JSON・空配列は null', () => {
    expect(migrateLegacyLocalStorage(null)).toBeNull()
    expect(migrateLegacyLocalStorage('{')).toBeNull()
    expect(migrateLegacyLocalStorage('{"files":[]}')).toBeNull()
  })
})
