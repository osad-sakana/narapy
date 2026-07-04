import type { NarapyProject } from '../fileio/index'
import type { FileRowState } from './fileRows'

// /make-url の入力行から共有用のNarapyProjectを組み立てる(issue #32)
export function buildProjectFromRows(rows: FileRowState[], activeIndex: number): NarapyProject {
  const trimmedRows = rows
    .map(row => ({ path: row.path.trim(), content: row.content }))
    .filter(row => row.path.length > 0)

  if (trimmedRows.length === 0) {
    throw new Error('少なくとも1つファイルパスを入力してください')
  }

  const paths = trimmedRows.map(row => row.path)
  if (new Set(paths).size !== paths.length) {
    throw new Error('ファイルパスが重複しています')
  }

  const activePath = rows[activeIndex]?.path.trim()
  const activeFile = activePath && paths.includes(activePath) ? activePath : paths[0]

  return {
    version: 2,
    files: trimmedRows.map(row => ({ path: row.path, content: { kind: 'text', data: row.content } })),
    directories: [],
    activeFile,
  }
}
