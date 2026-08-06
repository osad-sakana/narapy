import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteFile, getActiveContent, getActiveFile, getFile, loadProject, setActiveFile, updateFileContent, upsertFile } from '../explorer/store'
import { createFileSwitcher, type FileSwitcherDeps } from './fileSwitcher'
import type { OpenMode } from './modelRegistry'

// エディタバッファを模した簡易ハーネス。ファイルを開く操作(openEditorFile)を記録する。
function createEditorBuffer(initial = '') {
  let value = initial
  const opened: { path: string; mode: OpenMode }[] = []
  return {
    get: () => value,
    set: (v: string) => { value = v },
    opened,
    openFile: (path: string, content: string, mode: OpenMode) => {
      value = content
      opened.push({ path, mode })
    },
  }
}

type EditorBuffer = ReturnType<typeof createEditorBuffer>

function buildDeps(buffer: EditorBuffer): FileSwitcherDeps {
  return {
    openEditorFile: buffer.openFile,
    setSyncingEditor: vi.fn(),
    setActiveFile,
    getActiveContent,
    setFileName: vi.fn(),
  }
}

describe('createFileSwitcher', () => {
  beforeEach(() => {
    // state はモジュール単位のシングルトンなので、各テスト前にデフォルト状態へ明示的に戻す。
    loadProject([{ path: 'main.py', content: { kind: 'text', data: '' } }], [], 'main.py')
  })

  it('要件1: アクティブファイル削除 → switchToFile(next) でnextの内容が破壊されない(issue #45 回帰)', () => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'sub.py', content: { kind: 'text', data: 'サブの内容' } },
      ],
      [],
      'main.py',
    )
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    // main.py を表示中として editorPath を確定させる
    switcher.openProjectFile('main.py', 'メインの内容')

    expect(deleteFile('main.py')).toBe(true)
    const next = getActiveFile() // 削除により 'sub.py' へ自動的に切り替わる

    switcher.switchToFile(next)

    expect(next).toBe('sub.py')
    expect(getActiveContent()).toBe('サブの内容')
    expect(buffer.get()).toBe('サブの内容')
  })

  it('要件2: 同一パス切替（アップロード上書き）でストアの新内容が保持される', () => {
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    switcher.openProjectFile('main.py', '古いエディタ内容')

    // アップロードによりストアの内容が直接上書きされる（main.tsのアップロード処理を模す）
    upsertFile('main.py', { kind: 'text', data: 'アップロードされた新しい内容' })

    switcher.switchToFile('main.py')

    expect(getActiveContent()).toBe('アップロードされた新しい内容')
    expect(buffer.get()).toBe('アップロードされた新しい内容')
  })

  it('要件2b: 別パス切替（フォルダアップロード）で切替元のアップロード内容が潰されない(issue #48 回帰)', () => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: '元のmain' } },
        { path: 'a.py', content: { kind: 'text', data: '元のa' } },
      ],
      [],
      'main.py',
    )
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    switcher.openProjectFile('main.py', '古いエディタ内容')

    // main.py と a.py を含むフォルダのアップロードでストアが直接更新される
    upsertFile('main.py', { kind: 'text', data: 'アップロードされたmain' })
    upsertFile('a.py', { kind: 'text', data: 'アップロードされたa' })

    // firstTextPath が a.py になり、開いている main.py とは別パスへ切り替わる
    switcher.switchToFile('a.py')

    const saved = getFile('main.py')
    expect(saved?.content.kind === 'text' && saved.content.data).toBe('アップロードされたmain')
    expect(buffer.get()).toBe('アップロードされたa')
  })

  it('要件3: プロジェクト読込直後の switchToFile で新内容が保持される', () => {
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    switcher.openProjectFile('main.py', '元の内容')

    // applyProjectLoad 相当の処理: loadProject → openProjectFile で editorPath を新ファイルへ更新
    loadProject([{ path: 'new.py', content: { kind: 'text', data: '読み込んだ新しい内容' } }], [], 'new.py')
    switcher.openProjectFile(getActiveFile(), getActiveContent())

    // その直後に同じファイルへの switchToFile が呼ばれても内容が破壊されないこと
    switcher.switchToFile('new.py')

    expect(getActiveContent()).toBe('読み込んだ新しい内容')
    expect(buffer.get()).toBe('読み込んだ新しい内容')
  })

  it('切替先が非テキスト等で setActiveFile が false を返す場合、エディタもeditorPathも変更されない', () => {
    const buffer = createEditorBuffer()
    const setFileName = vi.fn()
    const switcher = createFileSwitcher({
      ...buildDeps(buffer),
      setActiveFile: () => false,
      setFileName,
    })
    switcher.openProjectFile('main.py', 'main.pyの内容')

    switcher.switchToFile('image.png')

    expect(switcher.getEditorPath()).toBe('main.py')
    expect(buffer.get()).toBe('main.pyの内容')
    expect(setFileName).not.toHaveBeenCalled()
  })

  it('M1: openProjectFileが例外を投げてもsetSyncingEditor(false)が呼ばれ、editorPathは更新される', () => {
    const setSyncingEditor = vi.fn()
    const switcher = createFileSwitcher({
      openEditorFile: () => { throw new Error('boom') },
      setSyncingEditor,
      setActiveFile: vi.fn(() => true),
      getActiveContent: () => '',
      setFileName: vi.fn(),
    })

    expect(() => switcher.openProjectFile('new.py', 'x')).toThrow('boom')
    expect(setSyncingEditor).toHaveBeenNthCalledWith(1, true)
    expect(setSyncingEditor).toHaveBeenNthCalledWith(2, false)
    expect(switcher.getEditorPath()).toBe('new.py')
  })

  it('通常のファイル切替: 打鍵で保存済みの内容が維持され、切替先の内容がエディタへ反映される', () => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'sub.py', content: { kind: 'text', data: 'サブの内容' } },
      ],
      [],
      'main.py',
    )
    const buffer = createEditorBuffer()
    const setFileName = vi.fn()
    const switcher = createFileSwitcher({ ...buildDeps(buffer), setFileName })
    switcher.openProjectFile('main.py', 'メインの内容(編集後)')
    // 打鍵時の onDidChangeModelContent 相当。ユーザー編集はこの経路で必ずストアへ届く。
    updateFileContent('main.py', 'メインの内容(編集後)')
    // その後にエディタバッファだけが乖離しても、切替時に書き戻されないこと(issue #48)
    buffer.set('ストアへ届いていない乖離内容')

    switcher.switchToFile('sub.py')

    expect(buffer.get()).toBe('サブの内容')
    expect(setFileName).toHaveBeenCalledWith('sub.py')
    expect(getActiveFile()).toBe('sub.py')

    // 切替元は打鍵時に保存された値のまま。switchToFile はストアへ書き込まない。
    const saved = getFile('main.py')
    expect(saved?.content.kind === 'text' && saved.content.data).toBe('メインの内容(編集後)')
  })

  it('issue #47: ファイル切替は in-place 書き込みではなくモデル差し替えで行われる', () => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'sub.py', content: { kind: 'text', data: 'サブの内容' } },
      ],
      [],
      'main.py',
    )
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    switcher.openProjectFile('main.py', 'メインの内容')

    switcher.switchToFile('sub.py')

    expect(buffer.opened).toEqual([
      { path: 'main.py', mode: 'reset' },
      { path: 'sub.py', mode: 'reuse' },
    ])
  })

  it('issue #47: 同一パスへの切替も mode reuse で開き、ストアの新内容が渡される', () => {
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    switcher.openProjectFile('main.py', '古いエディタ内容')

    upsertFile('main.py', { kind: 'text', data: 'アップロードされた新しい内容' })
    switcher.switchToFile('main.py')

    // 内容がずれていればモデル側（modelRegistry）が作り直す
    expect(buffer.opened.at(-1)).toEqual({ path: 'main.py', mode: 'reuse' })
    expect(buffer.get()).toBe('アップロードされた新しい内容')
  })

  it("issue #47: 起動時・プロジェクト読込は mode 'reset' で開く", () => {
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))

    switcher.openProjectFile('new.py', '読み込んだ新しい内容')

    expect(buffer.opened).toEqual([{ path: 'new.py', mode: 'reset' }])
  })
})
