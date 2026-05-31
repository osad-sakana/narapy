export interface FileEntry {
  name: string
  content: string
}

export interface FileState {
  files: FileEntry[]
  activeFile: string
}
