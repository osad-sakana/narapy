import type { NarapyProject } from '../fileio/index'
import type { FileRowState } from '../makeUrl/fileRows'
import { buildProjectFromRows } from '../makeUrl/buildProject'

// /make-exercise の入力行から演習(.exercise)用のNarapyProjectを組み立てる(issue #65)。
// ファイル行の集合・パスの重複チェック等は buildProjectFromRows にそのまま任せ、
// ここでは「問題文」「テスト」として指定された行を exercise メタデータに変換するだけ。
export function buildExerciseFromRows(
  rows: FileRowState[],
  activeIndex: number,
  problemIndex: number,
  testIndex: number,
): NarapyProject {
  const project = buildProjectFromRows(rows, activeIndex)

  const problemPath = rows[problemIndex]?.path.trim()
  const testPath = rows[testIndex]?.path.trim()
  if (!problemPath || !testPath) {
    throw new Error('問題文とテストのファイルを指定してください')
  }
  if (problemPath === testPath) {
    throw new Error('問題文とテストは別のファイルにしてください')
  }
  if (!project.files.some(f => f.path === problemPath)) {
    throw new Error(`問題文のファイル「${problemPath}」が見つかりません`)
  }
  if (!project.files.some(f => f.path === testPath)) {
    throw new Error(`テストのファイル「${testPath}」が見つかりません`)
  }

  return { ...project, exercise: { problem: problemPath, test: testPath } }
}
