import { describe, expect, it, vi } from 'vitest'
import type { NarapyProject } from '../fileio/index'
import { applyUrlLoad } from './applyUrlLoad'

const dummyProject: NarapyProject = {
  version: 2,
  files: [{ path: 'main.py', content: { kind: 'text', data: 'print(1)' } }],
  directories: [],
  activeFile: 'main.py',
}

describe('applyUrlLoad', () => {
  it('URLに読み込み対象がなければ何もしない', async () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    await applyUrlLoad({
      resolve: async () => null,
      hasUserContent: () => false,
      confirm: () => true,
      loadProject,
      refreshExplorer,
    })
    expect(loadProject).not.toHaveBeenCalled()
    expect(refreshExplorer).not.toHaveBeenCalled()
  })

  it('既存の作業内容がなければ確認なしで読み込む', async () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    const confirm = vi.fn()
    await applyUrlLoad({
      resolve: async () => ({ project: dummyProject, source: 'code' }),
      hasUserContent: () => false,
      confirm,
      loadProject,
      refreshExplorer,
    })
    expect(confirm).not.toHaveBeenCalled()
    expect(loadProject).toHaveBeenCalledWith(dummyProject.files, dummyProject.directories, dummyProject.activeFile)
    expect(refreshExplorer).toHaveBeenCalledTimes(1)
  })

  it('既存の作業内容があり確認で承認されれば読み込む', async () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    await applyUrlLoad({
      resolve: async () => ({ project: dummyProject, source: 'project' }),
      hasUserContent: () => true,
      confirm: () => true,
      loadProject,
      refreshExplorer,
    })
    expect(loadProject).toHaveBeenCalledWith(dummyProject.files, dummyProject.directories, dummyProject.activeFile)
    expect(refreshExplorer).toHaveBeenCalledTimes(1)
  })

  it('既存の作業内容があり確認が却下されれば読み込まない', async () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    await applyUrlLoad({
      resolve: async () => ({ project: dummyProject, source: 'project' }),
      hasUserContent: () => true,
      confirm: () => false,
      loadProject,
      refreshExplorer,
    })
    expect(loadProject).not.toHaveBeenCalled()
    expect(refreshExplorer).not.toHaveBeenCalled()
  })

  it('resolve側のエラーは呼び出し元に伝播する(呼び出し元でアラート表示するため)', async () => {
    const loadProject = vi.fn()
    const refreshExplorer = vi.fn()
    await expect(applyUrlLoad({
      resolve: async () => {
        throw new Error('boom')
      },
      hasUserContent: () => false,
      confirm: () => true,
      loadProject,
      refreshExplorer,
    })).rejects.toThrow('boom')
    expect(loadProject).not.toHaveBeenCalled()
  })

  it('exerciseメタデータ付きプロジェクトを読み込むとonExerciseLoadedへ渡る(issue #65)', async () => {
    const exerciseProject: NarapyProject = {
      ...dummyProject,
      files: [
        { path: 'main.py', content: { kind: 'text', data: 'def add(a, b): return a + b' } },
        { path: 'problem.md', content: { kind: 'text', data: '# 足し算' } },
        { path: 'test.py', content: { kind: 'text', data: 'def test_add(): assert add(1, 2) == 3' } },
      ],
      exercise: { problem: 'problem.md', test: 'test.py' },
    }
    const onExerciseLoaded = vi.fn()
    await applyUrlLoad({
      resolve: async () => ({ project: exerciseProject, source: 'project' }),
      hasUserContent: () => false,
      confirm: () => true,
      loadProject: vi.fn(),
      refreshExplorer: vi.fn(),
      onExerciseLoaded,
    })
    expect(onExerciseLoaded).toHaveBeenCalledWith(exerciseProject.exercise, exerciseProject.files)
  })

  it('exerciseメタデータが無ければonExerciseLoadedにundefinedが渡る', async () => {
    const onExerciseLoaded = vi.fn()
    await applyUrlLoad({
      resolve: async () => ({ project: dummyProject, source: 'code' }),
      hasUserContent: () => false,
      confirm: () => true,
      loadProject: vi.fn(),
      refreshExplorer: vi.fn(),
      onExerciseLoaded,
    })
    expect(onExerciseLoaded).toHaveBeenCalledWith(undefined, dummyProject.files)
  })
})
