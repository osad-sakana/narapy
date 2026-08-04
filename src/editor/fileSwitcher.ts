import type { OpenMode } from './modelRegistry'

export interface FileSwitcherDeps {
  getEditorValue: () => string
  // ファイルをエディタで開く（モデルごと差し替え。undoスタックにファイル切替を積まない）
  openEditorFile: (path: string, content: string, mode: OpenMode) => void
  // 表示中のモデルを in-place で書き換える（Blockly同期用。undo履歴を保つ）
  writeEditorContent: (content: string) => void
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
  openFile: (path: string, content: string) => void
  openProjectFile: (path: string, content: string) => void
  syncEditorContent: (path: string, content: string) => void
  switchToFile: (path: string) => void
}

// エディタが「今実際に表示している」ファイルパス(editorPath)を追跡し、
// ファイル切替時の退避先選択ロジックを提供する(issue #45)。
// getActiveFile()（ストア側のアクティブファイル）は loadProject や deleteFile 等で
// エディタ更新より先に書き換わることがあるため、退避先の判定には必ず
// このモジュールが内部で保持する editorPath を使い、getActiveFile() は使わない。
export function createFileSwitcher(deps: FileSwitcherDeps): FileSwitcher {
  let editorPath = ''

  // エディタへの書き込みを行う唯一の入り口。書き込みが例外を投げても
  // isSyncingEditor が true のまま固着しないよう try/finally で保護し、
  // editorPath は書き込みの成否に関わらず先に確定させる。
  function applyToEditor(path: string, write: () => void): void {
    deps.setSyncingEditor(true)
    editorPath = path
    try {
      write()
    } finally {
      deps.setSyncingEditor(false)
    }
  }

  // ファイルを開く（モデル差し替え）。既存モデルがあれば再利用され、
  // ファイルごとの undo 履歴が保たれる(issue #47)。
  function openFile(path: string, content: string): void {
    applyToEditor(path, () => deps.openEditorFile(path, content, 'reuse'))
  }

  // プロジェクト読込では全ファイルが入れ替わるため、既存モデルを全破棄する。
  // 再利用すると、読込前の内容が undo で復元され現在のファイルへ保存されてしまう(issue #47)。
  function openProjectFile(path: string, content: string): void {
    applyToEditor(path, () => deps.openEditorFile(path, content, 'reset'))
  }

  // Blockly から生成したコードの反映など、同じファイルの内容を書き換える用途。
  // undo 履歴を壊さないよう in-place の編集操作として適用する。
  function syncEditorContent(path: string, content: string): void {
    applyToEditor(path, () => deps.writeEditorContent(content))
  }

  function switchToFile(path: string): void {
    // 同一パスへの切替（アップロード等でストアの内容が既に更新済みのケース）では、
    // エディタの古いバッファを書き戻すと上書きしてしまうため保存自体をスキップする。
    const isSamePath = path === editorPath
    if (!isSamePath) {
      deps.updateFileContent(editorPath, deps.getEditorValue())
    }
    if (!deps.setActiveFile(path)) return
    const content = deps.getActiveContent()
    // 同一パスへの切替はストアが外部から上書きされたケース。既存モデルの undo 履歴には
    // 上書き前の内容が残っているため、モデルを作り直して履歴ごと捨てる(issue #47)。
    applyToEditor(path, () => deps.openEditorFile(path, content, isSamePath ? 'fresh' : 'reuse'))
    deps.setFileName(path)
    deps.runValidation(content)
    if (deps.isEditorActive()) {
      deps.convert(content)
    }
  }

  return {
    getEditorPath: () => editorPath,
    openFile,
    openProjectFile,
    syncEditorContent,
    switchToFile,
  }
}
