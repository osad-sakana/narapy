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

  it('取り込んだ演習のメタを渡せる', () => {
    const { deps, files } = buildDeps()
    const exercise = { problem: 'p', entryPath: 'a.py', testCode: 't' } as never
    applyProjectSwitch(deps, exercise)
    expect(deps.onExerciseLoaded).toHaveBeenCalledWith(exercise, files, 'a.py')
  })
})
