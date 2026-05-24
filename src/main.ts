import { applyBlocklyMessages } from './blockly/messages'
import { createWorkspace } from './blockly/workspace'
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

initRunner()
void loadWasm()
