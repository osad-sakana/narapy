import type { DirectoryEntry, FileEntry } from '../explorer/types'

export interface ProjectLoadInput {
  files: FileEntry[]
  directories: DirectoryEntry[]
  activeFile: string
}

export interface ApplyProjectLoadDeps {
  loadProject: (files: FileEntry[], directories: DirectoryEntry[], activeFile: string) => void
  refreshExplorer: () => void
  getActiveFile: () => string
  getActiveContent: () => string
  openProjectFile: (path: string, content: string) => void
  setEditorFileName: (path: string) => void
}

// .narapy プロジェクトの読込を適用するオーケストレーション(issue #45)。
// loadProject() が state.activeFile を書き換えた「後」に、必ず新しいアクティブファイルの
// 内容を取得してエディタへ反映する。読込前のエディタ内容を書き戻す処理は意図的に行わない
// (行うと、loadProject 後の getActiveFile() は既に新ファイルを指しているため、
// 新しく読み込んだ内容を古いエディタ内容で上書きしてしまう = issue #45 の再発)。
export function applyProjectLoad(input: ProjectLoadInput, deps: ApplyProjectLoadDeps): void {
  deps.loadProject(input.files, input.directories, input.activeFile)
  deps.refreshExplorer()

  const path = deps.getActiveFile()
  const content = deps.getActiveContent()
  deps.openProjectFile(path, content)
  deps.setEditorFileName(path)
}
