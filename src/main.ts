import { KeyMod, KeyCode } from 'monaco-editor'
import { applyBlocklyMessages } from './blockly/messages'
import { createWorkspace, isSyncingFromPython } from './blockly/workspace'
import { setTooltipsEnabled, isTooltipsEnabled } from './blockly/tooltips'
import { loadWasm, triggerValidation } from './runner/validator'
import { initRunner } from './runner/index'
import { applyPythonToWorkspace } from './converter/index'
import { createDebounced } from './converter/debounce'
import { createEditor, getValue, setValue } from './editor/index'
import { exportProjectAsNarapy, openFilePicker } from './fileio/index'
import { createExplorer } from './explorer/ui'
import {
  getActiveFile,
  getActiveContent,
  updateFileContent,
  setActiveFile,
  getAllFilesAsRecord,
  upsertFile,
  resetFiles,
} from './explorer/store'

applyBlocklyMessages()

// Monaco Editor を初期化
const editorContainer = document.getElementById('codeEditor') as HTMLElement
const editor = createEditor(editorContainer)

// --- アクティブパネル管理 ---
type ActiveSource = 'blockly' | 'editor'
let activeSource: ActiveSource = 'blockly'

// プログラム的なエディタ書き込み中フラグ（Blocklyやファイル切替など）
let isSyncingEditor = false

const blocklyHeader    = document.getElementById('blocklyHeader')    as HTMLElement
const editorHeader     = document.getElementById('editorHeader')     as HTMLElement
const blocklyActiveDot = document.getElementById('blocklyActiveDot') as HTMLElement
const editorActiveDot  = document.getElementById('editorActiveDot')  as HTMLElement
const editorFileName   = document.getElementById('editorFileName')   as HTMLElement

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

// --- ファイル切替 ---
function switchToFile(name: string): void {
  // 現在の内容を保存
  updateFileContent(getActiveFile(), getValue(editor))
  // ストアを切替
  setActiveFile(name)
  // エディタに新しい内容をロード（変更ハンドラを抑制）
  isSyncingEditor = true
  const content = getActiveContent()
  setValue(editor, content)
  isSyncingEditor = false
  // ファイル名表示を更新
  editorFileName.textContent = name
  // バリデーションと Blockly 変換
  void triggerValidation(content)
  if (activeSource === 'editor') {
    debouncedConvert.call(content)
  }
}

// --- Blockly ワークスペース ---
const workspace = createWorkspace((code) => {
  if (activeSource === 'editor') return
  if (codeEqual(getValue(editor), code)) return
  isSyncingEditor = true
  setValue(editor, code)
  isSyncingEditor = false
  // Blockly 生成コードをストアにも反映
  updateFileContent(getActiveFile(), code)
  void triggerValidation(code)
})

// Python→Blockly変換（300msデバウンス）
const debouncedConvert = createDebounced((source: string) => {
  void applyPythonToWorkspace(source, workspace)
}, 300)

// --- エディタ変更 ---
editor.onDidChangeModelContent(() => {
  if (isSyncingEditor) return
  setActiveSource('editor')
  const source = getValue(editor)
  // 変更をストアに保存
  updateFileContent(getActiveFile(), source)
  void triggerValidation(source)
  debouncedConvert.call(source)
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

// Blocklyの実際の変更（値変更・移動・追加・削除）でアクティブを確定してデバウンスをキャンセル
workspace.addChangeListener((event) => {
  if (!event.isUiEvent && !isSyncingFromPython()) {
    setActiveSource('blockly')
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

// --- ファイルエクスプローラー初期化 ---
const explorerContainer = document.getElementById('fileExplorer') as HTMLElement
const { refresh: refreshExplorer } = createExplorer(explorerContainer, (name) => {
  switchToFile(name)
  refreshExplorer()
})

// エディタを localStorage の内容で初期化
isSyncingEditor = true
setValue(editor, getActiveContent())
editorFileName.textContent = getActiveFile()
isSyncingEditor = false

// --- 新規プロジェクト ---
const newProjectBtn = document.getElementById('newProjectBtn') as HTMLButtonElement
newProjectBtn.addEventListener('click', () => {
  if (!window.confirm('現在のプロジェクトを破棄して新規作成しますか？')) return
  resetFiles([{ name: 'main.py', content: '' }])
  // switchToFile は先頭でエディタ内容を保存するため使わず直接リセット
  isSyncingEditor = true
  setValue(editor, '')
  isSyncingEditor = false
  editorFileName.textContent = 'main.py'
  void triggerValidation('')
  refreshExplorer()
})

// --- ファイル開く (.py / .narapy) ---
const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement
uploadBtn.addEventListener('click', () => {
  openFilePicker(
    (code, filename) => {
      const name = filename ?? 'main.py'
      upsertFile(name, code)
      switchToFile(name)
      refreshExplorer()
    },
    (files) => {
      // .narapy インポート: プロジェクト全体を置き換え
      const entries = Object.entries(files).map(([name, content]) => ({ name, content }))
      resetFiles(entries)
      const first = files['main.py'] !== undefined ? 'main.py' : Object.keys(files)[0]
      switchToFile(first)
      refreshExplorer()
    },
  )
})

// --- プロジェクト保存 (.narapy) ---
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
downloadBtn.addEventListener('click', () => {
  updateFileContent(getActiveFile(), getValue(editor))
  exportProjectAsNarapy(getAllFilesAsRecord())
})

initRunner(editor, () => {
  // 実行前に現在の内容をストアへ同期
  updateFileContent(getActiveFile(), getValue(editor))
  return getAllFilesAsRecord()
})
void loadWasm()
