import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteFile, getActiveContent, getActiveFile, getFile, loadProject, setActiveFile, updateFileContent, upsertFile } from '../explorer/store'
import { createFileSwitcher, type FileSwitcherDeps } from './fileSwitcher'

// エディタバッファを模した簡易ハーネス。setEditorValue/getEditorValue の実体を差し替え可能にする。
function createEditorBuffer(initial = ''): { get: () => string; set: (v: string) => void } {
  let value = initial
  return { get: () => value, set: (v) => { value = v } }
}

function buildDeps(buffer: { get: () => string; set: (v: string) => void }): FileSwitcherDeps {
  return {
    getEditorValue: buffer.get,
    setEditorValue: buffer.set,
    setSyncingEditor: vi.fn(),
    updateFileContent,
    setActiveFile,
    getActiveContent,
    setFileName: vi.fn(),
    runValidation: vi.fn(),
    isEditorActive: () => false,
    convert: vi.fn(),
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
    switcher.setEditorContent('main.py', 'メインの内容')

    expect(deleteFile('main.py')).toBe(true)
    const next = getActiveFile() // 削除により 'sub.py' へ自動的に切り替わる

    switcher.switchToFile(next)

    expect(next).toBe('sub.py')
    expect(getActiveContent()).toBe('サブの内容')
    expect(buffer.get()).toBe('サブの内容')
  })

  it('要件2: 同一パス切替（アップロード上書き）で退避がスキップされる', () => {
    const buffer = createEditorBuffer()
    const deps = buildDeps(buffer)
    const updateFileContentSpy = vi.fn(updateFileContent)
    const switcher = createFileSwitcher({ ...deps, updateFileContent: updateFileContentSpy })
    switcher.setEditorContent('main.py', '古いエディタ内容')

    // アップロードによりストアの内容が直接上書きされる（main.tsのアップロード処理を模す）
    upsertFile('main.py', { kind: 'text', data: 'アップロードされた新しい内容' })

    switcher.switchToFile('main.py')

    expect(updateFileContentSpy).not.toHaveBeenCalled()
    expect(getActiveContent()).toBe('アップロードされた新しい内容')
    expect(buffer.get()).toBe('アップロードされた新しい内容')
  })

  it('要件3: プロジェクト読込直後の switchToFile で新内容が保持される', () => {
    const buffer = createEditorBuffer()
    const switcher = createFileSwitcher(buildDeps(buffer))
    switcher.setEditorContent('main.py', '元の内容')

    // applyProjectLoad 相当の処理: loadProject → setEditorContent で editorPath を新ファイルへ更新
    loadProject([{ path: 'new.py', content: { kind: 'text', data: '読み込んだ新しい内容' } }], [], 'new.py')
    switcher.setEditorContent(getActiveFile(), getActiveContent())

    // その直後に同じファイルへの switchToFile が呼ばれても内容が破壊されないこと
    switcher.switchToFile('new.py')

    expect(getActiveContent()).toBe('読み込んだ新しい内容')
    expect(buffer.get()).toBe('読み込んだ新しい内容')
  })

  it('M1: setEditorValueが例外を投げてもsetSyncingEditor(false)が呼ばれ、editorPathは更新される', () => {
    const setSyncingEditor = vi.fn()
    const switcher = createFileSwitcher({
      getEditorValue: () => '',
      setEditorValue: () => { throw new Error('boom') },
      setSyncingEditor,
      updateFileContent: vi.fn(),
      setActiveFile: vi.fn(() => true),
      getActiveContent: () => '',
      setFileName: vi.fn(),
      runValidation: vi.fn(),
      isEditorActive: () => false,
      convert: vi.fn(),
    })

    expect(() => switcher.setEditorContent('new.py', 'x')).toThrow('boom')
    expect(setSyncingEditor).toHaveBeenNthCalledWith(1, true)
    expect(setSyncingEditor).toHaveBeenNthCalledWith(2, false)
    expect(switcher.getEditorPath()).toBe('new.py')
  })

  it('通常のファイル切替: 別ファイルへ切替えると退避が行われ、切替先の内容がエディタへ反映される', () => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'sub.py', content: { kind: 'text', data: 'サブの内容' } },
      ],
      [],
      'main.py',
    )
    const buffer = createEditorBuffer('メインの内容(編集後)')
    const setFileName = vi.fn()
    const runValidation = vi.fn()
    const switcher = createFileSwitcher({ ...buildDeps(buffer), setFileName, runValidation })
    switcher.setEditorContent('main.py', 'メインの内容(編集後)')

    switcher.switchToFile('sub.py')

    expect(buffer.get()).toBe('サブの内容')
    expect(setFileName).toHaveBeenCalledWith('sub.py')
    expect(runValidation).toHaveBeenCalledWith('サブの内容')
    // 退避が行われ、main.py の内容は編集後の値で保存されている
    expect(getActiveFile()).toBe('sub.py')

    // 退避が実際に行われたことを検証
    const saved = getFile('main.py')
    expect(saved?.content.kind === 'text' && saved.content.data).toBe('メインの内容(編集後)')
  })
})
