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
    const createProject = vi.fn()
    const refreshExplorer = vi.fn()
    const clearUrl = vi.fn()
    await applyUrlLoad({ resolve: async () => null, createProject, refreshExplorer, clearUrl })
    expect(createProject).not.toHaveBeenCalled()
    expect(refreshExplorer).not.toHaveBeenCalled()
    expect(clearUrl).not.toHaveBeenCalled()
  })

  it('読み込んだ内容を新しいプロジェクトとして作成し、URLを消す', async () => {
    const createProject = vi.fn()
    const refreshExplorer = vi.fn()
    const clearUrl = vi.fn()
    const result = { project: dummyProject, source: 'code' as const }
    await applyUrlLoad({ resolve: async () => result, createProject, refreshExplorer, clearUrl })
    expect(createProject).toHaveBeenCalledWith(result)
    expect(clearUrl).toHaveBeenCalledTimes(1)
    expect(refreshExplorer).toHaveBeenCalledTimes(1)
  })

  it('演習メタを通知する', async () => {
    const onExerciseLoaded = vi.fn()
    const exercise = { problem: 'p', test: 't' }
    await applyUrlLoad({
      resolve: async () => ({ project: { ...dummyProject, exercise }, source: 'project' }),
      createProject: vi.fn(),
      refreshExplorer: vi.fn(),
      onExerciseLoaded,
    })
    expect(onExerciseLoaded).toHaveBeenCalledWith(exercise, dummyProject.files, 'main.py')
  })
})
