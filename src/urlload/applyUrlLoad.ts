import type { DirectoryEntry, FileEntry } from '../explorer/types'
import { confirmOverwriteExistingWork } from './confirmOverwrite'
import { resolveProjectFromUrl, type UrlLoadResult } from './loadFromUrl'

export interface ApplyUrlLoadDeps {
  hasUserContent: () => boolean
  loadProject: (files: FileEntry[], directories: DirectoryEntry[], activeFile: string) => void
  refreshExplorer: () => void
  confirm?: () => boolean
  resolve?: () => Promise<UrlLoadResult | null>
}

// main.tsの起動シーケンスから呼ばれるオーケストレーション。
// 既存の作業内容がある場合のみ確認し、承認された場合だけ上書きする(issue #32)。
export async function applyUrlLoad(deps: ApplyUrlLoadDeps): Promise<void> {
  const resolve = deps.resolve ?? resolveProjectFromUrl
  const confirm = deps.confirm ?? confirmOverwriteExistingWork

  const result = await resolve()
  if (!result) return
  if (deps.hasUserContent() && !confirm()) return

  deps.loadProject(result.project.files, result.project.directories, result.project.activeFile)
  deps.refreshExplorer()
}
