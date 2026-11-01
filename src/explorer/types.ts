import type { ExerciseMeta } from '../fileio/index'

export type SharedSource = 'project' | 'code' | 'projectUrl'

export type FileContent =
  | { kind: 'text'; data: string }
  | { kind: 'binary'; data: Uint8Array; mime: string }

export interface FileEntry {
  path: string
  content: FileContent
}

export interface DirectoryEntry {
  path: string
}

export interface FileState {
  files: FileEntry[]
  directories: DirectoryEntry[]
  activeFile: string
}

export type FileKind = 'text' | 'binary'

export interface TreeFileNode {
  type: 'file'
  name: string
  path: string
  kind: FileKind
}

export interface TreeDirNode {
  type: 'dir'
  name: string
  path: string
  children: TreeNode[]
}

export type TreeNode = TreeFileNode | TreeDirNode

export interface ProjectRecord extends FileState {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  // 取り込んだ演習(.exercise)のメタ。切替・リロード後も演習モードを復元するために保存する
  exercise?: ExerciseMeta
  // 共有リンク由来のプロジェクト。リロード後も pygame 実行前の確認を出すために保存する
  sharedSource?: SharedSource
}

export interface ProjectInput extends FileState {
  exercise?: ExerciseMeta
  sharedSource?: SharedSource
}

export interface ProjectSummary {
  id: string
  title: string
}
