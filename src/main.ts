import { KeyMod, KeyCode } from 'monaco-editor'
import { initLayout } from './layout/index'
import { initRunner } from './runner/index'
import { clearLog } from './runner/log'
import { createEditor, createEditorModelHost, getValue } from './editor/index'
import { createFileOpener, createModelRegistry } from './editor/modelRegistry'
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
import { initTheme } from './theme/index'
import { initHamburgerMenu } from './menu/ui'
import { applyNewProject } from './menu/applyNewProject'
import { createInstructorController } from './instructor/controller'
import { createInstructorMenuAction, syncInstructorMenuItem, initInstructorBaselineButton } from './instructor/ui'

// createEditor が解決済みテーマを読むため、他の初期化より先に実行する
initTheme()

// initLayout() は createEditor() より先に呼ぶこと。
// Monaco は生成時にコンテナを実測するため、順序を入れ替えると初期サイズが崩れる
initLayout()

await initStore()

// Monaco Editor を初期化
const editorContainer = document.getElementById('codeEditor') as HTMLElement
const editor = createEditor(editorContainer)

const editorFileName   = document.getElementById('editorFileName')   as HTMLElement

// プログラム的なエディタ書き込み中フラグ（ファイル切替などで立てる）
let isSyncingEditor = false

// --- ファイル切替 ---
// エディタが「今実際に表示している」ファイルパス(editorPath)の追跡は fileSwitcher に集約する。
// getActiveFile()（ストア側のアクティブファイル）は loadProject や deleteFile 等で
// エディタ更新より先に書き換わることがあるため、ストアへの書き込み先には使わない(issue #45)。
// 切替時の退避は fileSwitcher では行わない（打鍵時に保存済みのため、issue #48）。
// ファイルごとにエディタモデルを持たせ、切替がundoスタックに積まれないようにする(issue #47)
const modelRegistry = createModelRegistry(createEditorModelHost(editor))
const listFilePaths = (): string[] => getFiles().map(f => f.path)

const fileSwitcher = createFileSwitcher({
  // ストアから消えたファイルのモデルを破棄してから開く。残しておくと、同名ファイルが
  // 再作成されたときに削除済みファイルの undo 履歴が復活してしまう(issue #47)
  openEditorFile: createFileOpener(modelRegistry, listFilePaths),
  setSyncingEditor: (syncing) => { isSyncingEditor = syncing },
  setActiveFile,
  getActiveContent,
  setFileName: (path) => { editorFileName.textContent = path },
})

// --- 講師モード ---
// 基準スナップショットは表示中のファイルパスと組にして持つため、パス追跡を持つ
// fileSwitcher の完成後に生成する
const instructorController = createInstructorController({
  editor,
  getEditorPath: () => fileSwitcher.getEditorPath(),
})

function switchToFile(path: string): void {
  // 装飾のクリアはモデル差し替え（fileSwitcher.switchToFile内のsetModel）の前に行う必要がある。
  // 差し替え後にクリアすると、古いモデル上の装飾IDが新モデルには存在せず無視されてしまう。
  instructorController.beforeActiveFileChange()
  fileSwitcher.switchToFile(path)
  instructorController.onActiveFileChanged()
}

// プロジェクト全体が入れ替わる場合（起動時・.narapyインポート・新規プロジェクト作成）は
// パスが偶然一致していても内容は別物なので、基準を無条件で破棄する
function openProjectFileWithReset(path: string, content: string): void {
  // switchToFile と同じ規律で、モデル差し替えの前に基準を破棄する。
  // 現状 openFile(mode:'reset') は常に旧モデルを破棄するため後でも実害はないが、
  // reset の実装詳細（同一パスなら再利用等）に暗黙依存しないようにする
  instructorController.discardBaseline()
  fileSwitcher.openProjectFile(path, content)
}

// --- エディタ変更 ---
// issue #48 で切替時の退避を削除したため、ここでのストア(メモリ上のstate)への書き込みは
// 同期・非デバウンスに保つこと。（IndexedDBへの永続化タイミングは store 側の関心事）
editor.onDidChangeModelContent(() => {
  if (isSyncingEditor) return
  const path = fileSwitcher.getEditorPath()
  // 起動シーケンス完了前（editorPath未確定、"" のまま）の変更は保存先が
  // 定まらないため無視する（issue #45 M2）
  if (!path) return
  const source = getValue(editor)
  // 変更をストアに保存（エディタが実際に表示しているパスへ、issue #45 L1）
  updateFileContent(path, source)
  instructorController.onContentChanged()
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
  (path) => {
    // 非アクティブなファイルの削除では切替が起きないため、ここでモデルを破棄する(issue #47)
    modelRegistry.prune(listFilePaths())
    // 削除されたファイルに対して基準を記録していた場合、無意味な差分表示にならないよう破棄する
    instructorController.discardBaselineIfPath(path)
  },
  (path) => {
    // アップロードによる上書きも、非アクティブファイルへは無言で内容だけが変わるため
    // 削除と同様に扱い、対象ファイルの基準があれば破棄する
    instructorController.discardBaselineIfPath(path)
  },
)

// --- URLパラメータからの初期プロジェクト読み込み (issue #32) ---
// #project= > #code= > ?project=<URL> の優先順位で解決する。既存の作業内容がある場合のみ確認する。
try {
  await applyUrlLoad({ hasUserContent, loadProject, refreshExplorer })
} catch (err) {
  window.alert(err instanceof Error ? err.message : String(err))
}

// エディタを永続化済みの内容で初期化。
// ?project=<URL> の読込待ちの間にユーザーがファイルを選択するとモデルが作られうるため、
// ここでは既存モデルを全破棄して開き、旧プロジェクトの undo 履歴を持ち越さない(issue #47)
openProjectFileWithReset(getActiveFile(), getActiveContent())
editorFileName.textContent = getActiveFile()


initRunner(editor, () => {
  // 実行前に現在の内容をストアへ同期（エディタが実際に表示しているパスへ、issue #45 L1）
  updateFileContent(fileSwitcher.getEditorPath(), getValue(editor))
  return getAllFilesForRun()
})

const outputLog = document.getElementById('outputLog') as HTMLElement
const fontControls = initFontSizeControls(
  (size) => {
    editor.updateOptions({ fontSize: size })
    outputLog.style.fontSize = `${size}px`
  },
  () => instructorController.fontProfile(),
)

const instructorBaselineButton = initInstructorBaselineButton(instructorController)

instructorController.setStateChangeListener(() => {
  fontControls.refresh()
  syncInstructorMenuItem(instructorController.isOn())
  instructorBaselineButton.sync()
})

// プロジェクト読込系オーケストレーション（.narapy を開く／新規作成）が共有する依存。
// 別々に組み立てると、どちらかだけ直して食い違う事故が起きうるため一箇所にまとめる。
const projectLoadDeps = {
  loadProject,
  refreshExplorer,
  getActiveFile,
  getActiveContent,
  openProjectFile: openProjectFileWithReset,
  setEditorFileName: (path: string) => { editorFileName.textContent = path },
}

// --- プロジェクトを開く (.narapy) ---
const importProjectBtn = document.getElementById('importProjectBtn') as HTMLButtonElement
importProjectBtn.addEventListener('click', () => {
  openNarapyFilePicker(
    (project) => {
      applyProjectLoad(
        { files: project.files, directories: project.directories, activeFile: project.activeFile },
        projectLoadDeps,
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

initAbout()

// --- 新規プロジェクト作成 (issue #58) ---
initHamburgerMenu([
  {
    label: '新規プロジェクト作成',
    onClick: () => {
      // リセット対象外のプロジェクトの実行結果が残り続けないよう、
      // 実際にリセットした場合のみログをクリアする（キャンセル時は何もしない）
      if (applyNewProject({ hasUserContent, ...projectLoadDeps })) clearLog()
    },
  },
  createInstructorMenuAction(instructorController),
])
