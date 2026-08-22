import { applyProjectLoad, type ApplyProjectLoadDeps } from '../fileio/applyProjectLoad'
import { createDefaultProject } from '../explorer/store'
import { confirmNewProject } from './confirmNewProject'

export interface ApplyNewProjectDeps extends ApplyProjectLoadDeps {
  hasUserContent: () => boolean
  confirm?: () => boolean
}

// 新規プロジェクト作成(issue #58)のオーケストレーション。既存の作業内容がある場合のみ
// 確認し、承認された場合だけ初期状態（main.py 1件）へリセットする。
// リセット前のエディタ→ストア同期は不要（打鍵時の onDidChangeModelContent が
// 既にストアへ書き込み済みのため、issue #48）。逆に loadProject の「後」に同期すると
// 新しい内容を古いエディタ内容で上書きしてしまうため、applyProjectLoad 側でも行わない(issue #45)。
// 戻り値はリセットを実際に行ったかどうか。呼び出し側はこれを見て、キャンセル時には
// 実行ログのクリアなど「リセットに付随する副作用」を起こさないようにする。
export function applyNewProject(deps: ApplyNewProjectDeps): boolean {
  const confirm = deps.confirm ?? confirmNewProject
  if (deps.hasUserContent() && !confirm()) return false
  applyProjectLoad(createDefaultProject(), deps)
  return true
}
