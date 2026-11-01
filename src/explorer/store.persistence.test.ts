import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  createProject,
  flushStore,
  getCurrentExercise,
  initStore,
  listSharedSources,
  switchProject,
  updateFileContent,
} from './store'
import { loadAll } from './persistence'

describe('store と IndexedDB の往復', () => {
  it('切替前の編集・演習メタ・共有元が保存され、再読み込みで残る', async () => {
    await initStore()
    const a = createProject('A', {
      files: [{ path: 'main.py', content: { kind: 'text', data: '' } }],
      directories: [],
      activeFile: 'main.py',
      exercise: { problem: 'p', test: 't' },
      sharedSource: 'code',
    })
    updateFileContent('main.py', 'print("a")')
    const b = createProject('B')
    updateFileContent('main.py', 'print("b")')
    await flushStore()

    const loaded = await loadAll(() => { throw new Error('既定プロジェクトは不要') })
    const byId = new Map(loaded.projects.map(p => [p.id, p]))
    const textOf = (id: string) => {
      const c = byId.get(id)?.files[0].content
      return c?.kind === 'text' ? c.data : null
    }
    expect(textOf(a.id)).toBe('print("a")')
    expect(textOf(b.id)).toBe('print("b")')
    expect(byId.get(a.id)?.exercise).toEqual({ problem: 'p', test: 't' })
    expect(byId.get(a.id)?.sharedSource).toBe('code')
    expect(byId.get(b.id)?.exercise).toBeUndefined()
    expect(loaded.currentId).toBe(b.id)
  })

  it('演習メタと共有元は切替・編集後も保たれる', async () => {
    const a = createProject('A2', {
      files: [{ path: 'main.py', content: { kind: 'text', data: '' } }],
      directories: [],
      activeFile: 'main.py',
      exercise: { problem: 'p2', test: 't2' },
      sharedSource: 'project',
    })
    createProject('B2')
    expect(getCurrentExercise()).toBeUndefined()
    switchProject(a.id)
    updateFileContent('main.py', 'x = 1')
    expect(getCurrentExercise()).toEqual({ problem: 'p2', test: 't2' })
    expect(listSharedSources().some(s => s.id === a.id && s.source === 'project')).toBe(true)
  })
})
