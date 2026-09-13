import type { FileEntry } from '../explorer/types'
import type { ExerciseMeta } from '../fileio/index'

export type { ExerciseMeta }

export interface LoadedExercise {
  meta: ExerciseMeta
  problemText: string
  testCode: string
  // 採点対象として固定するファイルパス（プロジェクトの activeFile）。
  // エディタで問題文やtest.pyを開いた状態で採点ボタンを押しても、常にこのファイルの
  // 内容が採点されるようにするため保持する(issue #65 レビュー指摘対応)。
  entryPath: string
}

// exercise メタデータが指す problem/test ファイルの中身をプロジェクトファイル群から
// 取り出す。メタデータはあるがファイルが見つからない・テキストでない等、壊れた
// .exercise を開いた場合は演習として扱わず null を返す（通常のプロジェクトとして
// ファイル自体は開けるようにフェイルセーフする）。
export function resolveExercise(
  exercise: ExerciseMeta | undefined,
  files: FileEntry[],
  activeFile: string,
): LoadedExercise | null {
  if (!exercise) return null

  const problemFile = files.find(f => f.path === exercise.problem)
  const testFile = files.find(f => f.path === exercise.test)
  const entryFile = files.find(f => f.path === activeFile)
  if (!problemFile || !testFile || !entryFile) return null
  if (problemFile.content.kind !== 'text' || testFile.content.kind !== 'text') return null
  if (entryFile.content.kind !== 'text') return null

  return {
    meta: exercise,
    problemText: problemFile.content.data,
    testCode: testFile.content.data,
    entryPath: activeFile,
  }
}
