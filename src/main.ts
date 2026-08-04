import { KeyMod, KeyCode } from 'monaco-editor'
import { initLayout, isBlocklyPanelHidden, onBlocklyPanelVisibilityChange } from './layout/index'
import { isBlocklyEnabled } from './blockly/featureFlag'
import { loadWasm, triggerValidation } from './runner/validator'
import { initRunner } from './runner/index'
import { createDebounced } from './converter/debounce'
import { shouldConvert, shouldResyncOnReveal, shouldReportConversionError, type ActiveSource } from './converter/conversionGuard'
import { createEditor, getValue, setValue } from './editor/index'
import { initFontSizeControls } from './editor/fontSize'
import { downloadNarapyProject, openNarapyFilePicker } from './fileio/index'
import { createExplorer } from './explorer/ui'
import { initAbout } from './about/index'
import {
  initStore,
  flushStore,
  getActiveFile,
  getActiveContent,
  updateFileContent,
  setActiveFile,
  getAllFilesForRun,
  loadProject,
  getFiles,
  getDirectories,
  hasUserContent,
} from './explorer/store'
import { applyUrlLoad } from './urlload/applyUrlLoad'
import { applyProjectLoad } from './fileio/applyProjectLoad'
import { createFileSwitcher } from './editor/fileSwitcher'

// Blocklyはデフォルトで無効。?blockly=1 のときのみ初期化・変換を行う（issue #31）
const blocklyEnabled = isBlocklyEnabled()

initLayout(blocklyEnabled)

// 構文チェックはBlockly変換の前段としての役割が主なため、Blockly無効時は行わない（issue #37）
function runValidation(source: string): void {
  if (blocklyEnabled) void triggerValidation(source)
}

await initStore()

// Monaco Editor を初期化
const editorContainer = document.getElementById('codeEditor') as HTMLElement
const editor = createEditor(editorContainer)

// --- アクティブパネル管理 ---
let activeSource: ActiveSource = 'blockly'

// プログラム的なエディタ書き込み中フラグ（Blocklyやファイル切替など）
let isSyncingEditor = false

const blocklyHeader    = document.getElementById('blocklyHeader')    as HTMLElement
const editorHeader     = document.getElementById('editorHeader')     as HTMLElement
const blocklyActiveDot = document.getElementById('blocklyActiveDot') as HTMLElement
const editorActiveDot  = document.getElementById('editorActiveDot')  as HTMLElement
const editorFileName   = document.getElementById('editorFileName')   as HTMLElement
const validationBadge  = document.getElementById('validationBadge')  as HTMLElement

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

// Blockly無効時はパネルが存在しないため、常にエディタをアクティブ扱いにする
// また構文チェックを行わないため、バッジ自体も表示しない（issue #37）
if (!blocklyEnabled) {
  setActiveSource('editor')
  validationBadge.style.display = 'none'
}

function codeEqual(a: string, b: string): boolean {
  return a.trimEnd() === b.trimEnd()
}

// Python→Blockly変換（300msデバウンス）。Blockly無効時は常にno-op
let debouncedConvert: { call: (source: string) => void; cancel: () => void } = {
  call: () => {},
  cancel: () => {},
}

// --- ファイル切替 ---
// エディタが「今実際に表示している」ファイルパス(editorPath)の追跡は fileSwitcher に集約する。
// getActiveFile()（ストア側のアクティブファイル）は loadProject や deleteFile 等で
// エディタ更新より先に書き換わることがあるため、ストアへの書き込み先には使わない(issue #45)。
// 切替時の退避は fileSwitcher では行わない（打鍵時とBlockly反映時に保存済みのため、issue #48）。
const fileSwitcher = createFileSwitcher({
  setEditorValue: (content) => setValue(editor, content),
  setSyncingEditor: (syncing) => { isSyncingEditor = syncing },
  setActiveFile,
  getActiveContent,
  setFileName: (path) => { editorFileName.textContent = path },
  runValidation,
  isEditorActive: () => activeSource === 'editor',
  convert: (source) => debouncedConvert.call(source),
})

function switchToFile(path: string): void {
  fileSwitcher.switchToFile(path)
}

// --- Blockly ワークスペース（?blockly=1 のときのみ初期化・変換を行う） ---
if (blocklyEnabled) {
  const { applyBlocklyMessages } = await import('./blockly/messages')
  const { createWorkspace, isSyncingFromPython } = await import('./blockly/workspace')
  const { applyPythonToWorkspace } = await import('./converter/index')
  const { setTooltipsEnabled, isTooltipsEnabled } = await import('./blockly/tooltips')

  applyBlocklyMessages()

  const workspace = createWorkspace((code) => {
    if (activeSource === 'editor') return
    if (codeEqual(getValue(editor), code)) return
    const path = fileSwitcher.getEditorPath()
    // 起動シーケンス完了前（editorPath未確定、"" のまま）にBlocklyが操作されると、
    // 反映先のファイルが定まらないため無視する（issue #45 M2）
    if (!path) return
    fileSwitcher.setEditorContent(path, code)
    // Blockly 生成コードをストアにも反映（ファイル切替は発生しないため editorPath と同義）
    updateFileContent(path, code)
    runValidation(code)
  })

  // Blocklyパネルが非表示の間は無駄な変換を行わない
  // 呼び出し時点のactiveSourceは常に'editor'（'blockly'への遷移は必ずdebouncedConvert.cancel()を伴うため）
  // なのでshouldReportConversionErrorは常にfalseになる。Python編集起点の変換エラーで
  // 構文検証結果を表示する共有バッジを上書きしないための意図的な挙動（issue #37）
  debouncedConvert = createDebounced((source: string) => {
    if (!shouldConvert(isBlocklyPanelHidden())) return
    void applyPythonToWorkspace(source, workspace, shouldReportConversionError(activeSource))
  }, 300)

  // Blocklyパネルが再表示された時、非表示中に編集された可能性のある
  // 最新のPythonコードで一度だけ再同期する
  onBlocklyPanelVisibilityChange((hidden) => {
    if (shouldResyncOnReveal(hidden, activeSource)) {
      // 非表示中に仕込まれた保留中の変換と二重実行にならないようキャンセルする
      debouncedConvert.cancel()
      void applyPythonToWorkspace(getValue(editor), workspace, shouldReportConversionError(activeSource))
    }
  })

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

  // --- ヒントトグル ---
  const hintToggleBtn = document.getElementById('hintToggleBtn') as HTMLButtonElement
  hintToggleBtn.addEventListener('click', () => {
    const next = !isTooltipsEnabled()
    setTooltipsEnabled(next)
    hintToggleBtn.className = next
      ? 'flex items-center gap-1 text-xs text-sky-400 hover:text-sky-200 transition-colors cursor-pointer'
      : 'flex items-center gap-1 text-xs text-sky-800 hover:text-sky-600 transition-colors cursor-pointer'
  })
}

// --- エディタ変更 ---
// issue #48 で切替時の退避を削除したため、ここでのストア(メモリ上のstate)への書き込みは
// 同期・非デバウンスに保つこと。下の debouncedConvert に合わせてデバウンスすると、
// ファイル切替直前の編集が失われる。（IndexedDBへの永続化タイミングは store 側の関心事）
editor.onDidChangeModelContent(() => {
  if (isSyncingEditor) return
  const path = fileSwitcher.getEditorPath()
  // 起動シーケンス完了前（editorPath未確定、"" のまま）の変更は保存先が
  // 定まらないため無視する（issue #45 M2）
  if (!path) return
  setActiveSource('editor')
  const source = getValue(editor)
  // 変更をストアに保存（エディタが実際に表示しているパスへ、issue #45 L1）
  updateFileContent(path, source)
  runValidation(source)
  debouncedConvert.call(source)
})

// --- キーボードショートカット ---
editor.addCommand(
  KeyMod.CtrlCmd | KeyCode.Enter,
  () => document.getElementById('runBtn')?.click(),
)

// --- ファイルエクスプローラー初期化 ---
const explorerContainer = document.getElementById('fileExplorer') as HTMLElement
const { refresh: refreshExplorer } = createExplorer(
  explorerContainer,
  (path) => {
    switchToFile(path)
    refreshExplorer()
  },
  (message) => window.alert(message),
)

// --- URLパラメータからの初期プロジェクト読み込み (issue #32) ---
// #project= > #code= > ?project=<URL> の優先順位で解決する。既存の作業内容がある場合のみ確認する。
try {
  await applyUrlLoad({ hasUserContent, loadProject, refreshExplorer })
} catch (err) {
  window.alert(err instanceof Error ? err.message : String(err))
}

// エディタを永続化済みの内容で初期化
fileSwitcher.setEditorContent(getActiveFile(), getActiveContent())
editorFileName.textContent = getActiveFile()


initRunner(editor, () => {
  // 実行前に現在の内容をストアへ同期（エディタが実際に表示しているパスへ、issue #45 L1）
  updateFileContent(fileSwitcher.getEditorPath(), getValue(editor))
  return getAllFilesForRun()
})

const outputLog = document.getElementById('outputLog') as HTMLElement
initFontSizeControls((size) => {
  editor.updateOptions({ fontSize: size })
  outputLog.style.fontSize = `${size}px`
})

// --- プロジェクトを開く (.narapy) ---
const importProjectBtn = document.getElementById('importProjectBtn') as HTMLButtonElement
importProjectBtn.addEventListener('click', () => {
  openNarapyFilePicker(
    (project) => {
      applyProjectLoad(
        { files: project.files, directories: project.directories, activeFile: project.activeFile },
        {
          loadProject,
          refreshExplorer,
          getActiveFile,
          getActiveContent,
          setEditorValue: fileSwitcher.setEditorContent,
          setEditorFileName: (path) => { editorFileName.textContent = path },
          runValidation,
          isEditorActive: () => activeSource === 'editor',
          convert: (source) => debouncedConvert.call(source),
        },
      )
    },
    (message) => window.alert(message),
  )
})

// --- プロジェクトを保存 (.narapy) ---
const exportProjectBtn = document.getElementById('exportProjectBtn') as HTMLButtonElement
exportProjectBtn.addEventListener('click', async () => {
  // エディタが実際に表示しているパスへ同期する（issue #45 L1）
  updateFileContent(fileSwitcher.getEditorPath(), getValue(editor))
  await flushStore()
  downloadNarapyProject({
    version: 2,
    files: getFiles().map(f => ({
      path: f.path,
      content: f.content.kind === 'text'
        ? { kind: 'text', data: f.content.data }
        : { kind: 'binary', data: f.content.data, mime: f.content.mime },
    })),
    directories: getDirectories().map(d => ({ path: d.path })),
    activeFile: getActiveFile(),
  })
})

void loadWasm()
initAbout()
