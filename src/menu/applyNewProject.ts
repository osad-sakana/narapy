import { applyProjectLoad, type ApplyProjectLoadDeps } from '../fileio/applyProjectLoad'
import { createDefaultProject } from '../explorer/store'
import { confirmNewProject } from './confirmNewProject'

export interface ApplyNewProjectDeps extends ApplyProjectLoadDeps {
  hasUserContent: () => boolean
  confirm?: () => boolean
}

// 新規プロジェクト作成(issue #58)のオーケストレーション。既存の作業内容がある場合のみ
// 確認し、承認された場合だけ初期状態（main.py 1件）へリセットする。
// applyProjectLoad と異なりリセット前のエディタ→ストア同期は行わない
// （同期すると破棄したいはずの現在の内容がストアに書き戻ってしまう。importProjectBtn と同じ理由）。
export function applyNewProject(deps: ApplyNewProjectDeps): void {
  const confirm = deps.confirm ?? confirmNewProject
  if (deps.hasUserContent() && !confirm()) return
  applyProjectLoad(createDefaultProject(), deps)
}
