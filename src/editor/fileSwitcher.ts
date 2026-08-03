export interface FileSwitcherDeps {
  getEditorValue: () => string
  setEditorValue: (content: string) => void
  setSyncingEditor: (syncing: boolean) => void
  updateFileContent: (path: string, content: string) => void
  setActiveFile: (path: string) => boolean
  getActiveContent: () => string
  setFileName: (path: string) => void
  runValidation: (source: string) => void
  isEditorActive: () => boolean
  convert: (source: string) => void
}

export interface FileSwitcher {
  getEditorPath: () => string
  setEditorContent: (path: string, content: string) => void
  switchToFile: (path: string) => void
}

// エディタが「今実際に表示している」ファイルパス(editorPath)を追跡し、
// ファイル切替時の退避先選択ロジックを提供する(issue #45)。
// getActiveFile()（ストア側のアクティブファイル）は loadProject や deleteFile 等で
// エディタ更新より先に書き換わることがあるため、退避先の判定には必ず
// このモジュールが内部で保持する editorPath を使い、getActiveFile() は使わない。
export function createFileSwitcher(deps: FileSwitcherDeps): FileSwitcher {
  let editorPath = ''

  // editor.setValue 相当を呼ぶ唯一の入り口。setEditorValue が例外を投げても
  // isSyncingEditor が true のまま固着しないよう try/finally で保護し、
  // editorPath は setEditorValue の成否に関わらず先に確定させる。
  function setEditorContent(path: string, content: string): void {
    deps.setSyncingEditor(true)
    editorPath = path
    try {
      deps.setEditorValue(content)
    } finally {
      deps.setSyncingEditor(false)
    }
  }

  function switchToFile(path: string): void {
    // 同一パスへの切替（アップロード等でストアの内容が既に更新済みのケース）では、
    // エディタの古いバッファを書き戻すと上書きしてしまうため保存自体をスキップする。
    if (path !== editorPath) {
      deps.updateFileContent(editorPath, deps.getEditorValue())
    }
    if (!deps.setActiveFile(path)) return
    const content = deps.getActiveContent()
    setEditorContent(path, content)
    deps.setFileName(path)
    deps.runValidation(content)
    if (deps.isEditorActive()) {
      deps.convert(content)
    }
  }

  return {
    getEditorPath: () => editorPath,
    setEditorContent,
    switchToFile,
  }
}
