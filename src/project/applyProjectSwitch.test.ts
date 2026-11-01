import { describe, expect, it, vi } from 'vitest'
import { applyProjectSwitch } from './applyProjectSwitch'

function buildDeps() {
  const calls: string[] = []
  const track = (name: string) => vi.fn(() => { calls.push(name) })
  const files = [{ path: 'a.py', content: { kind: 'text' as const, data: 'x' } }]
  return {
    calls,
    files,
    deps: {
      refreshExplorer: track('refreshExplorer'),
      getFiles: vi.fn(() => files),
      getActiveFile: vi.fn(() => 'a.py'),
      getActiveContent: vi.fn(() => 'x'),
      openProjectFile: track('openProjectFile'),
      setEditorFileName: track('setEditorFileName'),
      refreshProjectBar: track('refreshProjectBar'),
      clearLog: track('clearLog'),
      getExercise: vi.fn(() => undefined as { problem: string; test: string } | undefined),
      onExerciseLoaded: track('onExerciseLoaded'),
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
      'onExerciseLoaded',
    ])
    expect(deps.openProjectFile).toHaveBeenCalledWith('a.py', 'x')
    expect(deps.setEditorFileName).toHaveBeenCalledWith('a.py')
  })

  it('演習メタが無ければ undefined で通知する（演習パネルを閉じる契機）', () => {
    const { deps, files } = buildDeps()
    applyProjectSwitch(deps)
    expect(deps.onExerciseLoaded).toHaveBeenCalledWith(undefined, files, 'a.py')
  })

  it('現在のプロジェクトの演習メタを渡す', () => {
    const { deps, files } = buildDeps()
    const exercise = { problem: 'p', test: 't' }
    deps.getExercise.mockReturnValue(exercise)
    applyProjectSwitch(deps)
    expect(deps.onExerciseLoaded).toHaveBeenCalledWith(exercise, files, 'a.py')
  })
})
