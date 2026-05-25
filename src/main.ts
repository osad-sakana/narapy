import { applyBlocklyMessages } from './blockly/messages'
import { createWorkspace } from './blockly/workspace'
import { setTooltipsEnabled, isTooltipsEnabled } from './blockly/tooltips'
import { loadWasm, triggerValidation } from './runner/validator'
import { initRunner } from './runner/index'

applyBlocklyMessages()

const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement

createWorkspace((code) => {
  codeEditor.value = code
  void triggerValidation(code)
})

codeEditor.addEventListener('input', () => {
  void triggerValidation(codeEditor.value)
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
