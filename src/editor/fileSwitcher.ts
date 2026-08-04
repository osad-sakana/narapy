import type { OpenMode } from './modelRegistry'

export interface FileSwitcherDeps {
  // ファイルをエディタで開く（モデルごと差し替え。undoスタックにファイル切替を積まない）
  openEditorFile: (path: string, content: string, mode: OpenMode) => void
  // 表示中のモデルを in-place で書き換える（Blockly同期用。undo履歴を保つ）
  writeEditorContent: (content: string) => void
  setSyncingEditor: (syncing: boolean) => void
  setActiveFile: (path: string) => boolean
  getActiveContent: () => string
  setFileName: (path: string) => void
  runValidation: (source: string) => void
  isEditorActive: () => boolean
  convert: (source: string) => void
}

export interface FileSwitcher {
  getEditorPath: () => string
  openProjectFile: (path: string, content: string) => void
  syncEditorContent: (path: string, content: string) => void
  switchToFile: (path: string) => void
}

// エディタが「今実際に表示している」ファイルパス(editorPath)を追跡する(issue #45)。
// 呼び出し側（打鍵時の保存・Blockly生成コードの反映・実行前同期・エクスポート時同期）は
// 書き込み先パスとしてこの editorPath を使う。getActiveFile()（ストア側のアクティブファイル）は
// loadProject や deleteFile 等でエディタ更新より先に書き換わることがあるため使わない。
//
// 切替時にエディタ内容をストアへ退避する処理は持たない(issue #48)。
// エディタ内容の変更は打鍵時の onDidChangeModelContent と Blockly 生成コードの反映が
// いずれもその場でストアへ書き込むため、切替時の退避は冗長であるうえ、
// アップロード等でストアが先に更新されているケースで古いバッファが新しい内容を潰す。
//
// エディタへの書き込みは「モデルごと差し替える切替」と「表示中モデルの in-place 書き換え」の
// 2種類に分かれる。切替を in-place で行うと undo スタックに積まれ、Ctrl+Z で切替前の
// ファイルの内容が現在のファイルへ書き戻されてしまう(issue #47)。
export function createFileSwitcher(deps: FileSwitcherDeps): FileSwitcher {
  let editorPath = ''

  // エディタへの書き込みを行う唯一の入り口。書き込みが例外を投げても
  // isSyncingEditor が true のまま固着しないよう try/finally で保護し、
  // editorPath は書き込みの成否に関わらず先に確定させる。
  // switchToFile では setActiveFile が既に成功しているため、書き込みが失敗しても
  // editorPath をストアの activeFile と一致させておく方が食い違いが小さい。
  function applyToEditor(path: string, write: () => void): void {
    deps.setSyncingEditor(true)
    editorPath = path
    try {
      write()
    } finally {
      deps.setSyncingEditor(false)
    }
  }

  // 起動時とプロジェクト読込後の初回オープン。全ファイルが入れ替わるため既存モデルを全破棄する。
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
    if (!deps.setActiveFile(path)) return
    const content = deps.getActiveContent()
    // 同一パスへの切替（アップロード等でストアが外部から上書きされたケース）も reuse でよい。
    // 内容がストアとずれていればモデルは作り直され、一致する場合に残る undo 履歴は
    // 同じファイル自身のものなので、issue #47 のクロスファイル混入にはならない。
    applyToEditor(path, () => deps.openEditorFile(path, content, 'reuse'))
    deps.setFileName(path)
    deps.runValidation(content)
    if (deps.isEditorActive()) {
      deps.convert(content)
    }
  }

  return {
    getEditorPath: () => editorPath,
    openProjectFile,
    syncEditorContent,
    switchToFile,
  }
}
