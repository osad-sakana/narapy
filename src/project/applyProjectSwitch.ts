import type { CurrentExercise } from '../explorer/store'

export interface ApplyProjectSwitchDeps {
  refreshExplorer: () => void
  getActiveFile: () => string
  getActiveContent: () => string
  openProjectFile: (path: string, content: string) => void
  setEditorFileName: (path: string) => void
  refreshProjectBar: () => void
  clearLog: () => void
  // 現在のプロジェクトの演習メタ。演習でなければ undefined（演習パネルを閉じる契機になる）
  getExercise: () => CurrentExercise | undefined
  restoreExercise: (saved: CurrentExercise | undefined) => void
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
  deps.restoreExercise(deps.getExercise())
}
