import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { getFontSize } from './fontSize'
import { PALETTES, bareHex, type Palette, type ResolvedTheme } from '../theme/palette'
import { getResolvedTheme, onThemeChange } from '../theme/index'
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

const THEME_NAMES: Record<ResolvedTheme, string> = {
  dark: 'narapy-dark',
  light: 'narapy-light',
}

// Monaco は CSS 変数を解釈できないため、テーマごとに hex を焼き込んだ定義を用意して
// 切替時に setTheme() で差し替える
function defineThemes(): void {
  for (const theme of ['dark', 'light'] as const) {
    const c: Palette = PALETTES[theme]
    monaco.editor.defineTheme(THEME_NAMES[theme], {
      base: theme === 'dark' ? 'vs-dark' : 'vs',
      inherit: true,
      // rules の foreground は先頭 '#' を受け付けないため bareHex を使う
      rules: [
        { token: 'keyword', foreground: bareHex(c, 'codeKeyword') },
        { token: 'string', foreground: bareHex(c, 'codeString') },
        { token: 'number', foreground: bareHex(c, 'codeNumber') },
        { token: 'comment', foreground: bareHex(c, 'codeComment'), fontStyle: 'italic' },
        { token: 'identifier', foreground: bareHex(c, 'code') },
        { token: 'delimiter', foreground: bareHex(c, 'muted') },
        { token: 'type', foreground: bareHex(c, 'codeBuiltin') },
      ],
      colors: {
        'editor.background': c.editor,
        'editor.foreground': c.code,
        'editor.lineHighlightBackground': c.panel,
        // 選択範囲はアクセントの薄い重ね（末尾2桁は不透明度）
        'editor.selectionBackground': `${c.accent}3d`,
        'editor.inactiveSelectionBackground': `${c.accent}1f`,
        'editorLineNumber.foreground': c.codeComment,
        'editorLineNumber.activeForeground': c.ink,
        'editorCursor.foreground': c.accent,
        'editorIndentGuide.background1': c.line,
        'editorIndentGuide.activeBackground1': c.muted,
        'scrollbarSlider.background': `${c.line}80`,
        'scrollbarSlider.hoverBackground': c.muted,
        // 補完ウィジェット。前景色を省くとベーステーマ（vs / vs-dark）の既定値が残り、
        // ライトでは選択行が白文字 × ほぼ白背景になって読めなくなるため、
        // 背景を指定した項目は対になる前景色も必ず指定すること。
        'editorWidget.background': c.panel,
        'editorWidget.border': c.line,
        'editorWidget.foreground': c.ink,
        'editorSuggestWidget.background': c.panel,
        'editorSuggestWidget.border': c.line,
        'editorSuggestWidget.foreground': c.ink,
        // 選択行はアクセントの薄い重ね（末尾2桁は不透明度）。ホバーの hover 色だけだと
        // ライトでは panel との差がほとんど無く、どれが選択中か分からない
        'editorSuggestWidget.selectedBackground': `${c.accent}26`,
        'editorSuggestWidget.selectedForeground': c.ink,
        'editorSuggestWidget.selectedIconForeground': c.ink,
        // 入力と一致した部分。accent は面色に対して 3.5:1 程度しか出ず 13px では不足するため、
        // 同系色で「コード面の上で読ませる」ために調整済みの codeBuiltin を使う（5:1 以上）
        'editorSuggestWidget.highlightForeground': c.codeBuiltin,
        'editorSuggestWidget.focusHighlightForeground': c.codeBuiltin,
        'editorSuggestWidgetStatus.foreground': c.muted,
        // 型名などの補足テキストと、マウスホバー中の行
        'descriptionForeground': c.muted,
        'list.hoverBackground': c.hover,
        'list.hoverForeground': c.ink,
      },
    })
  }
}

export function createEditor(container: HTMLElement): EditorInstance {
  defineThemes()
  // setTheme はエディタ単位ではなくグローバルに効くため、インスタンスは参照しない
  onThemeChange((theme) => monaco.editor.setTheme(THEME_NAMES[theme]))

  const editor = monaco.editor.create(container, {
    value: '',
    language: 'python',
    theme: THEME_NAMES[getResolvedTheme()],
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
