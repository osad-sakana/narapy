import * as monaco from 'monaco-editor'
import { getFontSize } from './fontSize'
import { registerPythonCompletion } from './completion'

export type EditorInstance = monaco.editor.IStandaloneCodeEditor

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

export function setValue(editor: EditorInstance, code: string): void {
  const model = editor.getModel()
  if (!model) return
  // undoスタックを壊さないようにeditOperationを使う
  model.pushEditOperations(
    [],
    [{ range: model.getFullModelRange(), text: code }],
    () => null,
  )
}
