import { describe, expect, it, vi } from 'vitest'
import { applyNewProject } from './applyNewProject'

function buildDeps(hasUserContent: boolean, confirm: () => boolean) {
  return {
    hasUserContent: () => hasUserContent,
    confirm,
    loadProject: vi.fn(),
    refreshExplorer: vi.fn(),
    getActiveFile: vi.fn().mockReturnValue('main.py'),
    getActiveContent: vi.fn().mockReturnValue(''),
    openProjectFile: vi.fn(),
    setEditorFileName: vi.fn(),
  }
}

describe('applyNewProject', () => {
  it('作業内容が無ければ確認なしでリセットする', () => {
    const deps = buildDeps(false, vi.fn().mockReturnValue(true))
    expect(applyNewProject(deps)).toBe(true)

    expect(deps.confirm).not.toHaveBeenCalled()
    expect(deps.loadProject).toHaveBeenCalledWith(
      [{ path: 'main.py', content: { kind: 'text', data: '' } }],
      [],
      'main.py',
    )
    expect(deps.refreshExplorer).toHaveBeenCalledTimes(1)
  })

  it('作業内容があり確認でOKならリセットする', () => {
    const deps = buildDeps(true, vi.fn().mockReturnValue(true))
    expect(applyNewProject(deps)).toBe(true)

    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.loadProject).toHaveBeenCalledTimes(1)
    expect(deps.openProjectFile).toHaveBeenCalledWith('main.py', '')
    expect(deps.setEditorFileName).toHaveBeenCalledWith('main.py')
  })

  it('作業内容があり確認でキャンセルすれば何も実行しない(データ損失防止)', () => {
    const deps = buildDeps(true, vi.fn().mockReturnValue(false))
    // false を返すことで、呼び出し側(main.ts)がログクリア等の副作用を
    // 起こさないようにする契約(issue #58 レビュー2回目対応)
    expect(applyNewProject(deps)).toBe(false)

    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.loadProject).not.toHaveBeenCalled()
    expect(deps.refreshExplorer).not.toHaveBeenCalled()
    expect(deps.openProjectFile).not.toHaveBeenCalled()
    expect(deps.setEditorFileName).not.toHaveBeenCalled()
  })
})
