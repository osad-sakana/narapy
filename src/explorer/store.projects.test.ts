import { describe, expect, it } from 'vitest'
import {
  createProject,
  deleteProject,
  getActiveContent,
  getCurrentProject,
  getFiles,
  listProjects,
  loadProject,
  renameProject,
  switchProject,
  updateFileContent,
} from './store'

// store はモジュール単位のシングルトンで、テスト間で作ったプロジェクトが残る。
// 各テストは自分で作ったプロジェクトの id だけを前提にする。
describe('複数プロジェクト', () => {
  it('作成したプロジェクト同士でファイルが混ざらない', () => {
    const a = createProject('A')
    updateFileContent('main.py', 'print("a")')
    const b = createProject('B')
    expect(getActiveContent()).toBe('')
    updateFileContent('main.py', 'print("b")')

    expect(switchProject(a.id)).toBe(true)
    expect(getActiveContent()).toBe('print("a")')
    expect(switchProject(b.id)).toBe(true)
    expect(getActiveContent()).toBe('print("b")')
  })

  it('作成すると現在のプロジェクトになり一覧に載る', () => {
    const p = createProject('  課題  ')
    expect(getCurrentProject()).toEqual({ id: p.id, title: '課題' })
    expect(listProjects().map(x => x.id)).toContain(p.id)
  })

  it('入力状態を指定して作成できる', () => {
    createProject('X', {
      files: [{ path: 'a.py', content: { kind: 'text', data: 'x' } }],
      directories: [{ path: 'd' }],
      activeFile: 'a.py',
    })
    expect(getFiles().map(f => f.path)).toEqual(['a.py'])
    expect(getActiveContent()).toBe('x')
  })

  it('存在しない id への切替は失敗し、現在のプロジェクトを変えない', () => {
    const p = createProject('P')
    expect(switchProject('nope')).toBe(false)
    expect(getCurrentProject().id).toBe(p.id)
  })

  it('タイトルを変更でき、空なら既定名になる', () => {
    createProject('旧')
    expect(renameProject('新').title).toBe('新')
    expect(renameProject('  ').title).toBe('無題のプロジェクト')
  })

  it('現在のプロジェクトを削除すると別のプロジェクトへ切り替わる', () => {
    const a = createProject('A')
    const b = createProject('B')
    expect(deleteProject(b.id)).toBe(true)
    expect(listProjects().map(x => x.id)).not.toContain(b.id)
    expect(getCurrentProject().id).not.toBe(b.id)
    expect(listProjects().map(x => x.id)).toContain(a.id)
  })

  it('現在以外のプロジェクトを削除しても現在は変わらない', () => {
    const a = createProject('A')
    const b = createProject('B')
    expect(deleteProject(a.id)).toBe(true)
    expect(getCurrentProject().id).toBe(b.id)
  })

  it('最後の 1 件は削除できない', () => {
    for (const p of listProjects().slice(1)) deleteProject(p.id)
    const only = listProjects()
    expect(only).toHaveLength(1)
    expect(deleteProject(only[0].id)).toBe(false)
  })

  it('loadProject は現在のプロジェクトにだけ影響する', () => {
    const a = createProject('A')
    updateFileContent('main.py', 'keep')
    createProject('B')
    loadProject([{ path: 'z.py', content: { kind: 'text', data: 'z' } }], [], 'z.py')
    switchProject(a.id)
    expect(getActiveContent()).toBe('keep')
  })
})
