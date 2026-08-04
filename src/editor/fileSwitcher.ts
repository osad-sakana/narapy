export interface FileSwitcherDeps {
  setEditorValue: (content: string) => void
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
  setEditorContent: (path: string, content: string) => void
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
