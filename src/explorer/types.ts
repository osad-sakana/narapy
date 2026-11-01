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
  updatedAt: number
}

export interface ProjectSummary {
  id: string
  title: string
}
