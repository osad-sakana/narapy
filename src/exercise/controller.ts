import type { FileEntry } from '../explorer/types'
import { resolveExercise, type ExerciseMeta, type LoadedExercise } from './types'
import { showProblemModal } from './problemModal'
import { renderGradeResult } from './resultLog'

export interface ExerciseControllerDeps {
  setGradeControlsVisible: (visible: boolean) => void
}

export interface ExerciseController {
  // プロジェクトが（再）読込されるたびに呼ぶ。演習でなければ current を null にし、
  // 採点関連UIを隠す（通常のプロジェクトを開いた後に演習パネルが残らないようにする）
  onProjectLoaded: (exercise: ExerciseMeta | undefined, files: FileEntry[]) => void
  getTestCode: () => string | null
  onGradeResult: (json: string) => void
  showProblem: () => void
}

export function createExerciseController(deps: ExerciseControllerDeps): ExerciseController {
  let current: LoadedExercise | null = null

  function onProjectLoaded(exercise: ExerciseMeta | undefined, files: FileEntry[]): void {
    current = resolveExercise(exercise, files)
    deps.setGradeControlsVisible(current !== null)
    if (current) showProblemModal(current.problemText)
  }

  return {
    onProjectLoaded,
    getTestCode: () => current?.testCode ?? null,
    onGradeResult: renderGradeResult,
    showProblem: () => { if (current) showProblemModal(current.problemText) },
  }
}
