import { describe, expect, it } from 'vitest'
import type { RunFile } from '../types'
import { syncFiles, topLevelPyModuleNames, type FsLike } from './fsSync'

const WORK = '/home/pyodide'

// 最小限のインメモリ FS。mkdir は親が無いと失敗する実 FS と同じ挙動にする
function createFakeFs() {
  const dirs = new Set<string>(['/', '/home'])
  const files = new Map<string, string | Uint8Array>()
  const fs: FsLike = {
    analyzePath: (path) => ({ exists: dirs.has(path) || files.has(path) }),
    mkdir: (path) => {
      const parent = path.slice(0, path.lastIndexOf('/')) || '/'
      if (!dirs.has(parent)) throw new Error(`ENOENT: ${parent}`)
      dirs.add(path)
    },
    writeFile: (path, data) => {
      const parent = path.slice(0, path.lastIndexOf('/')) || '/'
      if (!dirs.has(parent)) throw new Error(`ENOENT: ${parent}`)
      files.set(path, data)
    },
    unlink: (path) => {
      if (!files.delete(path)) throw new Error(`ENOENT: ${path}`)
    },
  }
  return { fs, dirs, files }
}

const text = (path: string, data = ''): RunFile => ({ kind: 'text', path, data })
const binary = (path: string, data: number[]): RunFile => ({ kind: 'binary', path, data: new Uint8Array(data) })

describe('syncFiles', () => {
  it('テキストとバイナリ（画像等）を作業ディレクトリへ書き込む', () => {
    const { fs, files } = createFakeFs()
    syncFiles(fs, WORK, new Set(), [text('main.py', 'print(1)'), binary('player.png', [1, 2, 3])], [])

    expect(files.get(`${WORK}/main.py`)).toBe('print(1)')
    expect(files.get(`${WORK}/player.png`)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('サブディレクトリ内のアセットも親ディレクトリごと作って書き込む', () => {
    const { fs, files, dirs } = createFakeFs()
    syncFiles(fs, WORK, new Set(), [binary('assets/img/a.png', [9])], [])

    expect(dirs.has(`${WORK}/assets/img`)).toBe(true)
    expect(files.has(`${WORK}/assets/img/a.png`)).toBe(true)
  })

  it('空ディレクトリも作る', () => {
    const { fs, dirs } = createFakeFs()
    syncFiles(fs, WORK, new Set(), [], ['empty', 'a/b'])
    expect(dirs.has(`${WORK}/empty`)).toBe(true)
    expect(dirs.has(`${WORK}/a/b`)).toBe(true)
  })

  it('書き込んだファイルのパス集合を返す', () => {
    const { fs } = createFakeFs()
    const written = syncFiles(fs, WORK, new Set(), [text('a.py'), binary('b.png', [1])], [])
    expect(written).toEqual(new Set([`${WORK}/a.py`, `${WORK}/b.png`]))
  })

  it('前回書いたファイルのうち今回無くなったものは削除し、残るものは上書きする', () => {
    const { fs, files } = createFakeFs()
    const first = syncFiles(fs, WORK, new Set(), [text('a.py', 'old'), text('gone.png')], [])
    syncFiles(fs, WORK, first, [text('a.py', 'new')], [])

    expect(files.has(`${WORK}/gone.png`)).toBe(false)
    expect(files.get(`${WORK}/a.py`)).toBe('new')
  })

  it('前回のファイルを既に消せない場合も失敗しない', () => {
    const { fs } = createFakeFs()
    expect(() => syncFiles(fs, WORK, new Set([`${WORK}/missing.png`]), [text('a.py')], [])).not.toThrow()
  })

  it('入力の previous を変更しない', () => {
    const { fs } = createFakeFs()
    const previous: ReadonlySet<string> = Object.freeze(new Set([`${WORK}/x.png`])) as ReadonlySet<string>
    expect(() => syncFiles(fs, WORK, previous, [], [])).not.toThrow()
    expect(previous.size).toBe(1)
  })
})

describe('topLevelPyModuleNames', () => {
  it('直下の .py の拡張子抜き名だけを返す', () => {
    const files: RunFile[] = [
      text('main.py'),
      text('helper.py'),
      text('pkg/inner.py'),
      text('notes.txt'),
      binary('sprite.png', [1]),
    ]
    expect(topLevelPyModuleNames(files)).toEqual(['main', 'helper'])
  })
})
