import type { FileEntry } from '../explorer/types'
import { resolveExercise, type ExerciseMeta, type LoadedExercise } from './types'

export interface ExerciseControllerDeps {
  setGradeControlsVisible: (visible: boolean) => void
  // DOM操作(document.createElement等)を直接importせず注入することで、
  // controller自体をNode環境でもユニットテストできるようにする(issue #65 レビュー指摘対応)
  showProblem: (problemText: string) => void
  renderResult: (json: string) => void
  // exerciseメタデータはあるがproblem/test/activeFileが見つからない等、壊れた.exercise
  // を開いた場合に呼ぶ（学生には「採点ボタンが出ない」としか見えず原因が分かりにくいため）
  onBrokenExercise?: () => void
}

export interface ExerciseController {
  // プロジェクトが（再）読込されるたびに呼ぶ。演習でなければ current を null にし、
  // 採点関連UIを隠す（通常のプロジェクトを開いた後に演習パネルが残らないようにする）
  onProjectLoaded: (exercise: ExerciseMeta | undefined, files: FileEntry[], activeFile: string) => void
  // 採点対象として固定するファイルのパス。呼び出し側（main.ts）がこのパスの「今の」
  // 内容をストアから取得して採点する（エディタで別ファイルを開いていても、常にこの
  // ファイルが採点されるようにするため、内容そのものではなくパスだけを返す。
  // issue #65 レビュー指摘対応: 採点対象がエディタの表示中ファイルに引きずられる事故を防ぐ）
  getEntryPath: () => string | null
  getTestCode: () => string | null
  onGradeResult: (json: string) => void
  showProblem: () => void
}

export function createExerciseController(deps: ExerciseControllerDeps): ExerciseController {
  let current: LoadedExercise | null = null

  function onProjectLoaded(exercise: ExerciseMeta | undefined, files: FileEntry[], activeFile: string): void {
    current = resolveExercise(exercise, files, activeFile)
    deps.setGradeControlsVisible(current !== null)
    if (current) {
      deps.showProblem(current.problemText)
    } else if (exercise) {
      deps.onBrokenExercise?.()
    }
  }

  return {
    onProjectLoaded,
    getEntryPath: () => current?.entryPath ?? null,
    getTestCode: () => current?.testCode ?? null,
    onGradeResult: deps.renderResult,
    showProblem: () => { if (current) deps.showProblem(current.problemText) },
  }
}
