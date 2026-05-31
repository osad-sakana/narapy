import { KeyMod, KeyCode } from 'monaco-editor'
import { applyBlocklyMessages } from './blockly/messages'
import { createWorkspace, isSyncingFromPython } from './blockly/workspace'
import { setTooltipsEnabled, isTooltipsEnabled } from './blockly/tooltips'
import { loadWasm, triggerValidation } from './runner/validator'
import { initRunner } from './runner/index'
import { applyPythonToWorkspace } from './converter/index'
import { createDebounced } from './converter/debounce'
import { createEditor, getValue, setValue } from './editor/index'
import { downloadPythonFile, openFilePicker } from './fileio/index'

applyBlocklyMessages()

// Monaco Editor を初期化
const editorContainer = document.getElementById('codeEditor') as HTMLElement
const editor = createEditor(editorContainer)

// --- アクティブパネル管理 ---
type ActiveSource = 'blockly' | 'editor'
let activeSource: ActiveSource = 'blockly'

// Blockly→Editor のプログラム的書き込み中フラグ
let isSettingFromBlockly = false

const blocklyHeader   = document.getElementById('blocklyHeader')   as HTMLElement
const editorHeader    = document.getElementById('editorHeader')    as HTMLElement
const blocklyActiveDot = document.getElementById('blocklyActiveDot') as HTMLElement
const editorActiveDot  = document.getElementById('editorActiveDot')  as HTMLElement

function setActiveSource(source: ActiveSource): void {
  if (activeSource === source) return
  activeSource = source

  if (source === 'blockly') {
    blocklyHeader.classList.remove('opacity-50')
    editorHeader.classList.add('opacity-50')
    blocklyActiveDot.className = 'w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0'
    editorActiveDot.className  = 'w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0'
  } else {
    editorHeader.classList.remove('opacity-50')
    blocklyHeader.classList.add('opacity-50')
    editorActiveDot.className  = 'w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0'
    blocklyActiveDot.className = 'w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0'
  }
}

function codeEqual(a: string, b: string): boolean {
  return a.trimEnd() === b.trimEnd()
}

// --- Blockly ワークスペース ---
const workspace = createWorkspace((code) => {
  if (activeSource === 'editor') return
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

// --- エディタ変更 ---
editor.onDidChangeModelContent(() => {
  if (isSettingFromBlockly) return
  setActiveSource('editor')
  const source = getValue(editor)
  void triggerValidation(source)
  debouncedConvert.call(source)
})

// エディタへのフォーカスでアクティブを確定（クリック以外のフォーカス手段も捕捉）
editor.onDidFocusEditorWidget(() => {
  setActiveSource('editor')
})

// --- Blockly 操作 ---
// capture: true でBlockly内部のstopPropagationを回避して確実に捕捉する
const blocklyDiv = document.getElementById('blocklyDiv') as HTMLElement
blocklyDiv.addEventListener('mousedown', () => {
  setActiveSource('blockly')
  debouncedConvert.cancel()
}, { capture: true })
blocklyDiv.addEventListener('touchstart', () => {
  setActiveSource('blockly')
  debouncedConvert.cancel()
}, { capture: true, passive: true })

// Blockly変更時: エディタ→Blockly変換をキャンセル
workspace.addChangeListener((event) => {
  if (!event.isUiEvent && !isSyncingFromPython()) {
    debouncedConvert.cancel()
  }
})

// --- キーボードショートカット ---
editor.addCommand(
  KeyMod.CtrlCmd | KeyCode.Enter,
  () => document.getElementById('runBtn')?.click(),
)

// --- ヒントトグル ---
const hintToggleBtn = document.getElementById('hintToggleBtn') as HTMLButtonElement
hintToggleBtn.addEventListener('click', () => {
  const next = !isTooltipsEnabled()
  setTooltipsEnabled(next)
  hintToggleBtn.className = next
    ? 'flex items-center gap-1 text-xs text-sky-400 hover:text-sky-200 transition-colors cursor-pointer'
    : 'flex items-center gap-1 text-xs text-sky-800 hover:text-sky-600 transition-colors cursor-pointer'
})

// --- ファイル開く ---
const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement
uploadBtn.addEventListener('click', () => {
  openFilePicker((code) => {
    setActiveSource('editor')
    setValue(editor, code)
    void triggerValidation(code)
    debouncedConvert.call(code)
  })
})

// --- ファイル保存 ---
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
downloadBtn.addEventListener('click', () => {
  downloadPythonFile(getValue(editor))
})

initRunner(editor)
void loadWasm()
