import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultProject, createTextFile, createDirectory, deleteFile, getActiveContent, getActiveFile, getDirectories, getFile, hasUserContent, loadProject, moveEntry, setActiveFile, updateFileContent } from './store'

// state はモジュール単位のシングルトンなので、各テスト前にデフォルト状態へ明示的に戻す。
describe('hasUserContent', () => {
  beforeEach(() => {
    loadProject([{ path: 'main.py', content: { kind: 'text', data: '' } }], [], 'main.py')
  })

  it('デフォルト状態 (空のmain.pyのみ) ではfalse', () => {
    expect(hasUserContent()).toBe(false)
  })

  it('main.pyに内容があればtrue', () => {
    updateFileContent('main.py', 'print(1)')
    expect(hasUserContent()).toBe(true)
  })

  it('ファイルが追加されていればtrue', () => {
    createTextFile('sub.py', '')
    expect(hasUserContent()).toBe(true)
  })

  it('ディレクトリが追加されていればtrue', () => {
    createDirectory('assets')
    expect(hasUserContent()).toBe(true)
  })
})

// setActiveFile の契約確認: fileSwitcher.switchToFile はこの戻り値で早期returnを決めるため、
// fileSwitcher 側のテストで使うスタブが実挙動と乖離しないよう契約を固定する。
describe('setActiveFile: テキストファイルのみアクティブにできる', () => {
  beforeEach(() => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'image.png', content: { kind: 'binary', data: new Uint8Array([1, 2, 3]), mime: 'image/png' } },
      ],
      [],
      'main.py',
    )
  })

  it('バイナリファイルへの切替はfalseを返し、アクティブファイルは変わらない', () => {
    expect(setActiveFile('image.png')).toBe(false)
    expect(getActiveFile()).toBe('main.py')
  })

  it('存在しないパスへの切替はfalseを返し、アクティブファイルは変わらない', () => {
    expect(setActiveFile('missing.py')).toBe(false)
    expect(getActiveFile()).toBe('main.py')
  })

  it('同一パスへの切替はtrueを返す', () => {
    expect(setActiveFile('main.py')).toBe(true)
    expect(getActiveFile()).toBe('main.py')
  })
})

// updateFileContent の契約確認: 削除済み(=存在しない)パスへの書き込みは早期returnでno-opになる。
// これは main.ts の実行前同期・エクスポート前同期が editorPath を宛先に書き込む際、
// editorPath が削除済みファイルを指していても安全である根拠となる store 側の性質。
// （switchToFile は setActiveFile が false のとき早期returnして editorPath を更新しないため、
// editorPath は「更新されないまま削除されたパス」を指しうる）
// ファイル切替まわりの回帰シナリオ検証は src/editor/fileSwitcher.test.ts で行っている。
describe('updateFileContent: 存在しないパスへの書き込みはno-op', () => {
  beforeEach(() => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'sub.py', content: { kind: 'text', data: 'サブの内容' } },
      ],
      [],
      'main.py',
    )
  })

  it('削除済みのパスへ書き込んでも、他のファイルの内容には一切影響しない', () => {
    expect(deleteFile('main.py')).toBe(true)

    updateFileContent('main.py', '削除済みファイルへの書き込み')

    expect(getActiveFile()).toBe('sub.py')
    expect(getActiveContent()).toBe('サブの内容')
  })
})

// 新規プロジェクト作成(issue #58)の初期状態が、起動時のデフォルト状態と定義レベルで
// 一致していることを保証する。ずれると applyNewProject 直後に hasUserContent() が
// 誤って true を返し、URL読込用の確認ダイアログが意図せず出る不具合につながる。
describe('createDefaultProject', () => {
  it('main.py 1件のみ・空文字・ディレクトリ0件の初期状態を返す', () => {
    const project = createDefaultProject()
    expect(project).toEqual({
      files: [{ path: 'main.py', content: { kind: 'text', data: '' } }],
      directories: [],
      activeFile: 'main.py',
    })
  })

  it('呼び出すたびに新しいオブジェクトを返し、互いに汚染しない', () => {
    const first = createDefaultProject()
    const second = createDefaultProject()
    expect(first).not.toBe(second)
    expect(first.files).not.toBe(second.files)

    expect(first.files[0].content.kind).toBe('text')
    if (first.files[0].content.kind === 'text') first.files[0].content.data = '書き換え'
    expect(second.files[0].content).toEqual({ kind: 'text', data: '' })
  })
})

describe('moveEntry', () => {
  beforeEach(() => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メイン' } },
        { path: 'data/a.csv', content: { kind: 'text', data: 'a,b' } },
        { path: 'data/img.png', content: { kind: 'binary', data: new Uint8Array([1]), mime: 'image/png' } },
      ],
      [{ path: 'data' }, { path: 'lib' }],
      'main.py',
    )
  })

  it('ファイルを移動すると内容を保ったままパスが変わる', () => {
    const result = moveEntry({ type: 'file', path: 'main.py' }, 'lib')
    expect(result.ok).toBe(true)
    expect(getFile('main.py')).toBeUndefined()
    expect(getFile('lib/main.py')?.content).toEqual({ kind: 'text', data: 'メイン' })
  })

  it('アクティブファイルを移動するとアクティブも新しいパスになる', () => {
    moveEntry({ type: 'file', path: 'main.py' }, 'lib')
    expect(getActiveFile()).toBe('lib/main.py')
  })

  it('非アクティブファイルの移動ではアクティブは変わらない', () => {
    moveEntry({ type: 'file', path: 'data/a.csv' }, '')
    expect(getActiveFile()).toBe('main.py')
  })

  it('フォルダを移動すると配下のファイル（バイナリ含む）とフォルダが移る', () => {
    const result = moveEntry({ type: 'dir', path: 'data' }, 'lib')
    expect(result.ok).toBe(true)
    expect(getFile('lib/data/a.csv')?.content.kind).toBe('text')
    expect(getFile('lib/data/img.png')?.content.kind).toBe('binary')
    expect(getDirectories().map(d => d.path).sort()).toEqual(['lib', 'lib/data'])
  })

  it('アクティブファイルを含むフォルダを移動するとアクティブも追従する', () => {
    setActiveFile('data/a.csv')
    moveEntry({ type: 'dir', path: 'data' }, 'lib')
    expect(getActiveFile()).toBe('lib/data/a.csv')
  })

  it('失敗した場合は状態を変えない', () => {
    createTextFile('lib/main.py', '別')
    const result = moveEntry({ type: 'file', path: 'main.py' }, 'lib')
    expect(result).toEqual({ ok: false, reason: 'conflict' })
    expect(getFile('main.py')?.content).toEqual({ kind: 'text', data: 'メイン' })
  })
})
