import type { ProjectSummary } from '../explorer/types'

export interface ProjectBarDeps {
  listProjects: () => ProjectSummary[]
  getCurrent: () => ProjectSummary
  onCreate: () => void
  onSwitch: (id: string) => void
  onRename: (title: string) => void
  onDelete: (id: string) => void
}

export interface ProjectBar {
  refresh: () => void
}

// エディタ上部のプロジェクトバー。表示は常にストアの状態から作り直す（refresh）。
export function initProjectBar(root: ParentNode, deps: ProjectBarDeps): ProjectBar {
  const titleInput = root.querySelector<HTMLInputElement>('#projectTitleInput')!
  const select = root.querySelector<HTMLSelectElement>('#projectSelect')!
  const newBtn = root.querySelector<HTMLButtonElement>('#newProjectBtn')!
  const deleteBtn = root.querySelector<HTMLButtonElement>('#deleteProjectBtn')!

  function refresh(): void {
    const projects = deps.listProjects()
    const current = deps.getCurrent()
    select.replaceChildren(...projects.map(p => {
      const option = document.createElement('option')
      option.value = p.id
      option.textContent = p.title
      option.selected = p.id === current.id
      return option
    }))
    titleInput.value = current.title
    deleteBtn.disabled = projects.length <= 1
  }

  // Enter と blur の両方で確定する。Enter は blur を経由させて二重確定を避ける
  titleInput.addEventListener('change', () => {
    deps.onRename(titleInput.value)
    refresh()
  })
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) titleInput.blur()
  })
  select.addEventListener('change', () => deps.onSwitch(select.value))
  newBtn.addEventListener('click', () => deps.onCreate())
  deleteBtn.addEventListener('click', () => deps.onDelete(deps.getCurrent().id))

  refresh()
  return { refresh }
}
