// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initProjectBar } from './ui'

const HTML = `
  <input id="projectTitleInput" />
  <select id="projectSelect"></select>
  <button id="newProjectBtn"></button>
  <button id="deleteProjectBtn"></button>`

function setup(projects = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], currentId = 'a') {
  document.body.innerHTML = HTML
  const deps = {
    listProjects: () => projects,
    getCurrent: () => projects.find(p => p.id === currentId)!,
    onCreate: vi.fn(),
    onSwitch: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
  }
  const bar = initProjectBar(document, deps)
  return { deps, bar }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

describe('initProjectBar', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('一覧と現在のタイトルを表示する', () => {
    setup()
    const select = $<HTMLSelectElement>('projectSelect')
    expect(Array.from(select.options).map(o => o.textContent)).toEqual(['A', 'B'])
    expect(select.value).toBe('a')
    expect($<HTMLInputElement>('projectTitleInput').value).toBe('A')
  })

  it('タイトル変更・切替・新規・削除をコールバックへ渡す', () => {
    const { deps } = setup()
    const input = $<HTMLInputElement>('projectTitleInput')
    input.value = '新しい名前'
    input.dispatchEvent(new Event('change'))
    expect(deps.onRename).toHaveBeenCalledWith('新しい名前')

    const select = $<HTMLSelectElement>('projectSelect')
    select.value = 'b'
    select.dispatchEvent(new Event('change'))
    expect(deps.onSwitch).toHaveBeenCalledWith('b')

    $('newProjectBtn').click()
    expect(deps.onCreate).toHaveBeenCalled()

    $('deleteProjectBtn').click()
    expect(deps.onDelete).toHaveBeenCalledWith('a')
  })

  it('プロジェクトが 1 件だけなら削除ボタンを無効にする', () => {
    setup([{ id: 'a', title: 'A' }])
    expect($<HTMLButtonElement>('deleteProjectBtn').disabled).toBe(true)
  })
})
