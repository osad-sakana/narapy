import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { getFontSize } from './fontSize'
import { registerPythonCompletion } from './completion'
import type { ModelRegistryHost } from './modelRegistry'

export type EditorInstance = monaco.editor.IStandaloneCodeEditor

// vite-plugin-monaco-editor のinlineスクリプト(CSP違反)の代わりに
// Viteのworkerバンドルを使ってMonacoワーカーを同一オリジンから配信する
window.MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string): Worker {
    return new EditorWorker()
  },
}

registerPythonCompletion()

export function createEditor(container: HTMLElement): EditorInstance {
  monaco.editor.defineTheme('narapy-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c084fc' },       // violet-400
      { token: 'string', foreground: '86efac' },         // green-300
      { token: 'number', foreground: 'fb923c' },         // orange-400
      { token: 'comment', foreground: '475569', fontStyle: 'italic' }, // slate-600
      { token: 'identifier', foreground: 'e2e8f0' },     // slate-200
      { token: 'delimiter', foreground: '94a3b8' },      // slate-400
      { token: 'type', foreground: '67e8f9' },           // cyan-300
    ],
    colors: {
      'editor.background': '#0c0818',
      'editor.foreground': '#e2e8f0',
      'editor.lineHighlightBackground': '#1e1030',
      'editor.selectionBackground': '#4c1d95',
      'editor.inactiveSelectionBackground': '#2e1065',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#7c3aed',
      'editorCursor.foreground': '#a78bfa',
      'editorIndentGuide.background1': '#1e293b',
      'editorIndentGuide.activeBackground1': '#4c1d95',
      'scrollbarSlider.background': '#1e293b80',
      'scrollbarSlider.hoverBackground': '#334155',
    },
  })

  const editor = monaco.editor.create(container, {
    value: '',
    language: 'python',
    theme: 'narapy-dark',
    fontSize: getFontSize(),
    fontFamily: '"0xProto", "Fira Code", "Cascadia Code", monospace',
    fontLigatures: true,
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'on',
    renderWhitespace: 'boundary',
    bracketPairColorization: { enabled: true },
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoIndent: 'full',
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    acceptSuggestionOnEnter: 'off',
    tabCompletion: 'on',
    suggest: { showStatusBar: true },
    parameterHints: { enabled: false },
    hover: { enabled: false },
    // Ctrl+Enter / Cmd+Enter でコード実行（main.ts でハンドル）
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
    },
  })

  return editor
}

export function getValue(editor: EditorInstance): string {
  return editor.getValue()
}

// 表示中のモデルを in-place で書き換える。undoスタックを壊さないようにeditOperationを使う。
// ファイル切替には使わないこと（切替が undo 可能な編集操作になってしまうため、issue #47）。
// ファイル切替は modelRegistry 経由でモデルごと差し替える。
export function setValue(editor: EditorInstance, code: string): void {
  const model = editor.getModel()
  if (!model) return
  model.pushEditOperations(
    [],
    [{ range: model.getFullModelRange(), text: code }],
    () => null,
  )
}

// modelRegistry から Monaco を操作するためのアダプタ（issue #47）
export function createEditorModelHost(
  editor: EditorInstance,
): ModelRegistryHost<monaco.editor.ITextModel> {
  // createEditor() が生成した初期モデルは最初の差し替え以降不要になるため破棄する
  let initialModel: monaco.editor.ITextModel | null = editor.getModel()

  return {
    createModel: (content) => {
      const model = monaco.editor.createModel(content, 'python')
      // createModel は内容からインデントを推測する（detectIndentation の既定値が true）ため、
      // ファイルごとにタブ幅が変わらないよう createEditor と同じ設定を明示的に適用する
      model.updateOptions({ tabSize: 4, insertSpaces: true })
      return model
    },
    setModel: (model) => {
      editor.setModel(model)
      if (initialModel && initialModel !== model) {
        initialModel.dispose()
        initialModel = null
      }
    },
    saveViewState: () => editor.saveViewState(),
    restoreViewState: (state) => {
      editor.restoreViewState(state as monaco.editor.ICodeEditorViewState | null)
    },
  }
}
