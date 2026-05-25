import { KeyMod, KeyCode } from 'monaco-editor'
import { applyBlocklyMessages } from './blockly/messages'
import { createWorkspace, isSyncingFromPython } from './blockly/workspace'
import { setTooltipsEnabled, isTooltipsEnabled } from './blockly/tooltips'
import { loadWasm, triggerValidation } from './runner/validator'
import { initRunner } from './runner/index'
import { applyPythonToWorkspace } from './converter/index'
import { createDebounced } from './converter/debounce'
import { createEditor, getValue, setValue } from './editor/index'

applyBlocklyMessages()

// Monaco Editor を初期化
const editorContainer = document.getElementById('codeEditor') as HTMLElement
const editor = createEditor(editorContainer)

const workspace = createWorkspace((code) => {
  // エディタにフォーカス中（入力中）はBlockly側からの上書きを行わない
  if (!editor.hasTextFocus()) {
    setValue(editor, code)
    void triggerValidation(code)
  }
})

// Python→Blockly変換（300msデバウンス）
const debouncedConvert = createDebounced((source: string) => {
  void applyPythonToWorkspace(source, workspace)
}, 300)

editor.onDidChangeModelContent(() => {
  const source = getValue(editor)
  void triggerValidation(source)
  debouncedConvert.call(source)
})

// ユーザーによるBlockly操作時（同期中でない場合のみ）にpendingの変換をキャンセル
workspace.addChangeListener((event) => {
  if (!event.isUiEvent && !isSyncingFromPython()) {
    debouncedConvert.cancel()
  }
})

// Ctrl+Enter / Cmd+Enter でコード実行
editor.addCommand(
  KeyMod.CtrlCmd | KeyCode.Enter,
  () => document.getElementById('runBtn')?.click(),
)

// ヒントトグルボタン
const hintToggleBtn = document.getElementById('hintToggleBtn') as HTMLButtonElement
hintToggleBtn.addEventListener('click', () => {
  const next = !isTooltipsEnabled()
  setTooltipsEnabled(next)
  hintToggleBtn.className = next
    ? 'flex items-center gap-1 text-xs text-sky-400 hover:text-sky-200 transition-colors'
    : 'flex items-center gap-1 text-xs text-sky-800 hover:text-sky-600 transition-colors'
})

initRunner(editor)
void loadWasm()
