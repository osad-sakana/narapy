import { describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '../explorer/types'
import { applyProjectLoad, type ProjectLoadInput } from './applyProjectLoad'

function buildInput(activeFile: string, files: FileEntry[]): ProjectLoadInput {
  return { files, directories: [], activeFile }
}

describe('applyProjectLoad', () => {
  it('読み込み後に古いエディタ内容が新ファイルへ書き戻されない(issue #45 本命)', () => {
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
    const openProjectFile = vi.fn()

    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'サーバから読み込んだ新しい内容' } }]),
      {
        loadProject,
        refreshExplorer: vi.fn(),
        getActiveFile: () => active,
        getActiveContent: () => contents[active],
        openProjectFile,
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )

    // 古いエディタ内容('古いエディタ内容(未保存)')ではなく、新しく読み込んだ内容が渡ること
    expect(openProjectFile).toHaveBeenCalledWith('new.py', 'サーバから読み込んだ新しい内容')
    expect(openProjectFile).not.toHaveBeenCalledWith('new.py', '古いエディタ内容(未保存)')
  })

  it('呼び出し順序はloadProject → refreshExplorer → エディタ反映(内容/ファイル名/バリデーション)であること', () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    const openProjectFile = vi.fn()
    const setEditorFileName = vi.fn()
    const runValidation = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'print(1)' } }]),
      {
        loadProject,
        refreshExplorer,
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'print(1)',
        openProjectFile,
        setEditorFileName,
        runValidation,
        isEditorActive: () => false,
        convert: vi.fn(),
      },
    )

    expect(openProjectFile).toHaveBeenCalledWith('new.py', 'print(1)')
    expect(setEditorFileName).toHaveBeenCalledWith('new.py')
    expect(runValidation).toHaveBeenCalledWith('print(1)')
    expect(refreshExplorer).toHaveBeenCalledTimes(1)

    const loadOrder = loadProject.mock.invocationCallOrder[0]
    const refreshOrder = refreshExplorer.mock.invocationCallOrder[0]
    const editorOrder = openProjectFile.mock.invocationCallOrder[0]
    expect(loadOrder).toBeLessThan(refreshOrder)
    expect(refreshOrder).toBeLessThan(editorOrder)
  })

  it('activeSourceがeditorでないときはconvertが呼ばれない(Blockly誤変換の防止)', () => {
    const convert = vi.fn()
    applyProjectLoad(
      buildInput('new.py', [{ path: 'new.py', content: { kind: 'text', data: 'print(1)' } }]),
      {
        loadProject: vi.fn(),
        refreshExplorer: vi.fn(),
        getActiveFile: () => 'new.py',
        getActiveContent: () => 'print(1)',
        openProjectFile: vi.fn(),
        setEditorFileName: vi.fn(),
        runValidation: vi.fn(),
        isEditorActive: () => false,
        convert,
      },
    )
    expect(convert).not.toHaveBeenCalled()
  })
})
