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

// どちらが最後にユーザー操作したか
type EditSource = 'editor' | 'blockly'
let lastTouched: EditSource = 'blockly'
// Blockly→Editor のプログラム的書き込み中フラグ（onDidChangeModelContent で誤検知しないため）
let isSettingFromBlockly = false

function codeEqual(a: string, b: string): boolean {
  return a.trimEnd() === b.trimEnd()
}

const workspace = createWorkspace((code) => {
  // エディタ側が主導権を持っている間はBlocklyからの上書きを行わない
  if (lastTouched === 'editor') return
  // 内容が実質同じなら書き込みをスキップ
  if (codeEqual(getValue(editor), code)) return
  isSettingFromBlockly = true
  setValue(editor, code)
  isSettingFromBlockly = false
  void triggerValidation(code)
})

// Python→Blockly変換（300msデバウンス）
const debouncedConvert = createDebounced((source: string) => {
  void applyPythonToWorkspace(source, workspace)
}, 300)

editor.onDidChangeModelContent(() => {
  // プログラム的な書き込みは無視
  if (isSettingFromBlockly) return
  lastTouched = 'editor'
  const source = getValue(editor)
  void triggerValidation(source)
  debouncedConvert.call(source)
})

// ユーザーのBlockly操作はマウス/タッチで始まる（プログラム的なload()では発火しない）
const blocklyDiv = document.getElementById('blocklyDiv') as HTMLElement
blocklyDiv.addEventListener('mousedown', () => { lastTouched = 'blockly'; debouncedConvert.cancel() })
blocklyDiv.addEventListener('touchstart', () => { lastTouched = 'blockly'; debouncedConvert.cancel() }, { passive: true })

// Blockly変更時はエディタ→Blockly変換をキャンセル（ユーザー操作が主導権を持つ）
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
