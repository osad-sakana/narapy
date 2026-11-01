import type { FileEntry } from '../explorer/types'
import type { ExerciseMeta } from '../fileio/index'
import { resolveProjectFromUrl, type UrlLoadResult } from './loadFromUrl'

export interface ApplyUrlLoadDeps {
  // 読み込んだプロジェクトを新しいプロジェクトとして作成し、現在のプロジェクトにする。
  // 既存のプロジェクトは上書きしない(issue #86)
  createProject: (result: UrlLoadResult) => void
  refreshExplorer: () => void
  resolve?: () => Promise<UrlLoadResult | null>
  // プロジェクトの保存完了を待つ。完了前に URL を消すと、タブを閉じたときにどちらも失われる
  flush?: () => Promise<void>
  // 読込後に URL を消す。残すとリロードのたびに同じプロジェクトが増える
  clearUrl?: () => void
  onExerciseLoaded?: (exercise: ExerciseMeta | undefined, files: FileEntry[], activeFile: string) => void
}

// main.tsの起動シーケンスから呼ばれるオーケストレーション。
export async function applyUrlLoad(deps: ApplyUrlLoadDeps): Promise<void> {
  const resolve = deps.resolve ?? resolveProjectFromUrl

  const result = await resolve()
  if (!result) return

  deps.createProject(result)
  await deps.flush?.()
  deps.clearUrl?.()
  deps.refreshExplorer()
  deps.onExerciseLoaded?.(result.project.exercise, result.project.files, result.project.activeFile)
}
