import { describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '../explorer/types'
import { applyProjectLoad, type ProjectLoadInput } from './applyProjectLoad'

function buildInput(activeFile: string, files: FileEntry[]): ProjectLoadInput {
  return { files, directories: [], activeFile }
}

describe('applyProjectLoad', () => {
  it('読み込んだプロジェクトの内容がエディタに反映される (issue #45 回帰)', () => {
    const setEditorValue = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: '新しい内容' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'new.py',
        getActiveContent: () => '新しい内容',
        setEditorValue,
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )
    expect(setEditorValue).toHaveBeenCalledWith('new.py', '新しい内容')
  })

  it('読み込み後に古いエディタ内容が新ファイルへ書き戻されない(本命)', () => {
    // ストアの状態遷移を素朴にシミュレートする: loadProject が呼ばれるまでは
    // アクティブファイルは古いファイルのままで、古いエディタ内容が入っている。
    let active = 'main.py'
    const contents: Record<string, string> = { 'main.py': '古いエディタ内容(未保存)' }

    const loadProject = vi.fn((files: FileEntry[], _directories, activeFile: string) => {
      for (const f of files) {
        if (f.content.kind === 'text') contents[f.path] = f.content.data
      }
      active = activeFile
    })
    const setEditorValue = vi.fn()

    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'サーバから読み込んだ新しい内容' } }]),
      {
        loadProject,
        refreshExplorer: vi.fn(),
        getActiveFile: () => active,
        getActiveContent: () => contents[active],
        setEditorValue,
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )

    // 古いエディタ内容('古いエディタ内容(未保存)')ではなく、新しく読み込んだ内容が渡ること
    expect(setEditorValue).toHaveBeenCalledWith('new.py', 'サーバから読み込んだ新しい内容')
    expect(setEditorValue).not.toHaveBeenCalledWith('new.py', '古いエディタ内容(未保存)')
  })

  it('activeFileが現在と同名のケースでも新しい内容がエディタに反映される', () => {
    const setEditorValue = vi.fn()
    applyProjectLoad(
      buildInput('main.py', [{ path: 'main.py', content: { kind: 'text', data: '置き換え後の内容' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'main.py',
        getActiveContent: () => '置き換え後の内容',
        setEditorValue,
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )
    expect(setEditorValue).toHaveBeenCalledWith('main.py', '置き換え後の内容')
  })

  it('activeFileが現在と別名のケースでも新しい内容がエディタに反映される', () => {
    const setEditorValue = vi.fn()
    applyProjectLoad(
      buildInput('sub/utils.py', [{ path: 'sub/utils.py', content: { kind: 'text', data: 'サブモジュールの内容' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'sub/utils.py',
        getActiveContent: () => 'サブモジュールの内容',
        setEditorValue,
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )
    expect(setEditorValue).toHaveBeenCalledWith('sub/utils.py', 'サブモジュールの内容')
  })

  it('ファイル名表示が更新される', () => {
    const setEditorFileName = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'x' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'x',
        setEditorValue: vi.fn(),
        setEditorFileName,
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )
    expect(setEditorFileName).toHaveBeenCalledWith('new.py')
  })

  it('バリデーションが走る', () => {
    const runValidation = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'print(1)' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'print(1)',
        setEditorValue: vi.fn(),
        setEditorFileName: vi.fn(),
        runValidation,
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )
    expect(runValidation).toHaveBeenCalledWith('print(1)')
  })

  it('エクスプローラが再描画される', () => {
    const refreshExplorer = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'x' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer,
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'x',
        setEditorValue: vi.fn(),
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )
    expect(refreshExplorer).toHaveBeenCalledTimes(1)
  })

  it('activeSourceがeditorのときはconvertが呼ばれる', () => {
    const convert = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'print(1)' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'print(1)',
        setEditorValue: vi.fn(),
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => true,
        convert,
      },
    )
    expect(convert).toHaveBeenCalledWith('print(1)')
  })

  it('activeSourceがeditorでないときはconvertが呼ばれない', () => {
    const convert = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'print(1)' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'print(1)',
        setEditorValue: vi.fn(),
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert,
      },
    )
    expect(convert).not.toHaveBeenCalled()
  })

  it('呼び出し順序はloadProject → refreshExplorer → エディタ反映であること', () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    const setEditorValue = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'x' } }]),
      {
        loadProject,
        refreshExplorer,
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'x',
        setEditorValue,
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )

    const loadOrder = loadProject.mock.invocationCallOrder[0]
    const refreshOrder = refreshExplorer.mock.invocationCallOrder[0]
    const editorOrder = setEditorValue.mock.invocationCallOrder[0]
    expect(loadOrder).toBeLessThan(refreshOrder)
    expect(refreshOrder).toBeLessThan(editorOrder)
  })
})
