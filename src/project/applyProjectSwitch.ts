import type { ExerciseMeta } from '../fileio/index'
import type { FileEntry } from '../explorer/types'

export interface ApplyProjectSwitchDeps {
  refreshExplorer: () => void
  getFiles: () => FileEntry[]
  getActiveFile: () => string
  getActiveContent: () => string
  openProjectFile: (path: string, content: string) => void
  setEditorFileName: (path: string) => void
  refreshProjectBar: () => void
  clearLog: () => void
  // 現在のプロジェクトの演習メタ。演習でなければ undefined（演習パネルを閉じる契機になる）
  getExercise: () => ExerciseMeta | undefined
  onExerciseLoaded?: (exercise: ExerciseMeta | undefined, files: FileEntry[], activeFile: string) => void
}

// ストア側で現在のプロジェクトが入れ替わった「後」に、UI を新しい現在のプロジェクトへ揃える。
// 従来の読込処理と同じ規律で、読込前のエディタ内容は書き戻さない（書き戻すと
// 新しいプロジェクトを古いエディタ内容で上書きする、issue #45 の再発になる）。
export function applyProjectSwitch(deps: ApplyProjectSwitchDeps): void {
  deps.refreshExplorer()
  const path = deps.getActiveFile()
  deps.openProjectFile(path, deps.getActiveContent())
  deps.setEditorFileName(path)
  deps.refreshProjectBar()
  deps.clearLog()
  deps.onExerciseLoaded?.(deps.getExercise(), deps.getFiles(), path)
}
