import type { DirectoryEntry, FileEntry } from '../explorer/types'
import type { ExerciseMeta } from './index'

export interface ProjectLoadInput {
  files: FileEntry[]
  directories: DirectoryEntry[]
  activeFile: string
  exercise?: ExerciseMeta
}

export interface ApplyProjectLoadDeps {
  loadProject: (files: FileEntry[], directories: DirectoryEntry[], activeFile: string) => void
  refreshExplorer: () => void
  getActiveFile: () => string
  getActiveContent: () => string
  openProjectFile: (path: string, content: string) => void
  setEditorFileName: (path: string) => void
  // 演習(.exercise)の読込を検知するための任意フック(issue #65)。exercise が無い
  // 通常の.narapyプロジェクトでは undefined で呼ばれ、演習パネルを閉じる契機になる
  onExerciseLoaded?: (exercise: ExerciseMeta | undefined, files: FileEntry[], activeFile: string) => void
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
  deps.onExerciseLoaded?.(input.exercise, input.files, input.activeFile)
}
