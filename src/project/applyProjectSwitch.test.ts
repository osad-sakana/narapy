import { describe, expect, it, vi } from 'vitest'
import { applyProjectSwitch } from './applyProjectSwitch'
import type { CurrentExercise } from '../explorer/store'

function buildDeps() {
  const calls: string[] = []
  const track = (name: string) => vi.fn(() => { calls.push(name) })
  const files = [{ path: 'a.py', content: { kind: 'text' as const, data: 'x' } }]
  return {
    calls,
    files,
    deps: {
      refreshExplorer: track('refreshExplorer'),
      getActiveFile: vi.fn(() => 'a.py'),
      getActiveContent: vi.fn(() => 'x'),
      openProjectFile: track('openProjectFile'),
      setEditorFileName: track('setEditorFileName'),
      refreshProjectBar: track('refreshProjectBar'),
      clearLog: track('clearLog'),
      getExercise: vi.fn(() => undefined as CurrentExercise | undefined),
      restoreExercise: track('restoreExercise'),
    },
  }
}

describe('applyProjectSwitch', () => {
  it('現在のプロジェクトの内容でエディタ・UIを揃える', () => {
    const { deps, calls } = buildDeps()
    applyProjectSwitch(deps)
    expect(calls).toEqual([
      'refreshExplorer',
      'openProjectFile',
      'setEditorFileName',
      'refreshProjectBar',
      'clearLog',
      'restoreExercise',
    ])
    expect(deps.openProjectFile).toHaveBeenCalledWith('a.py', 'x')
    expect(deps.setEditorFileName).toHaveBeenCalledWith('a.py')
  })

  it('演習でなければ undefined で復元を呼ぶ（演習パネルを閉じる契機）', () => {
    const { deps } = buildDeps()
    applyProjectSwitch(deps)
    expect(deps.restoreExercise).toHaveBeenCalledWith(undefined)
  })

  it('現在のプロジェクトの演習メタを渡す', () => {
    const { deps } = buildDeps()
    const exercise: CurrentExercise = {
      meta: { problem: 'p', test: 't' },
      snapshot: { entryPath: 'a.py', problemText: 'P', testCode: 'T' },
    }
    deps.getExercise.mockReturnValue(exercise)
    applyProjectSwitch(deps)
    expect(deps.restoreExercise).toHaveBeenCalledWith(exercise)
  })
})
