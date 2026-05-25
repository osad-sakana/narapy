import { applyBlocklyMessages } from './blockly/messages'
import { createWorkspace, isSyncingFromPython } from './blockly/workspace'
import { setTooltipsEnabled, isTooltipsEnabled } from './blockly/tooltips'
import { loadWasm, triggerValidation } from './runner/validator'
import { initRunner } from './runner/index'
import { applyPythonToWorkspace } from './converter/index'
import { createDebounced } from './converter/debounce'

applyBlocklyMessages()

const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement

const workspace = createWorkspace((code) => {
  // エディタにフォーカス中（入力中）はBlockly側からの上書きを行わない
  if (document.activeElement !== codeEditor) {
    codeEditor.value = code
    void triggerValidation(code)
  }
})

// Python→Blockly変換（300msデバウンス）
const debouncedConvert = createDebounced((source: string) => {
  void applyPythonToWorkspace(source, workspace)
}, 300)

codeEditor.addEventListener('input', () => {
  void triggerValidation(codeEditor.value)
  debouncedConvert.call(codeEditor.value)
})

// ユーザーによるBlockly操作時（同期中でない場合のみ）にpendingの変換をキャンセル
workspace.addChangeListener((event) => {
  if (!event.isUiEvent && !isSyncingFromPython()) {
    debouncedConvert.cancel()
  }
})

// ヒントトグルボタン
const hintToggleBtn = document.getElementById('hintToggleBtn') as HTMLButtonElement
hintToggleBtn.addEventListener('click', () => {
  const next = !isTooltipsEnabled()
  setTooltipsEnabled(next)
  hintToggleBtn.className = next
    ? 'flex items-center gap-1 text-xs text-sky-400 hover:text-sky-200 transition-colors'
    : 'flex items-center gap-1 text-xs text-sky-800 hover:text-sky-600 transition-colors'
})

initRunner()
void loadWasm()
