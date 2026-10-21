import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from '../lib/pyodideLoader'
import type { PyodideInterface, PyodideModule } from '../pyodide/pyodideTypes'
import type { RunFile } from '../types'
import { syncFiles, topLevelPyModuleNames } from './fsSync'
import { BOOTSTRAP_CODE, CANCEL_CODE, CAN_RUN_SYNC_CODE, RUN_MAIN_CODE, STOP_FLAG } from './pythonSources'
import { startWatchdog } from './watchdog'

// SDL は <canvas> と DOM イベントを必要とするため、Worker ではなくメインスレッドの
// 専用 Pyodide で実行する（issue #73 の PoC）。通常実行の Worker とは完全に分離する。
interface MainPyodide extends PyodideInterface {
  runPython: (code: string, options?: { filename?: string }) => unknown
  runPythonAsync: (code: string, options?: { filename?: string }) => Promise<unknown>
  canvas: { setCanvas2D: (canvas: HTMLCanvasElement) => void }
  registerJsModule: (name: string, module: object) => void
}

// await を含まないループでメインスレッドが固まり、ウォッチドッグに止められたことを表す
export class PygameStalledError extends Error {
  constructor() {
    super('応答がなかったため実行を停止しました')
    this.name = 'PygameStalledError'
  }
}

// エクスプローラー上のプロジェクト（画像・フォント・.py 等）。通常実行の Worker と同じ形式
export interface PygameProject {
  files: RunFile[]
  directories: string[]
}

const WORK_DIR = '/home/pyodide'

// ブートストラップのラッパー関数のフレームに使うファイル名。ユーザーコードの "<exec>" と別にしないと、
// C 関数内で起きたエラー（set_mode(800, 600) 等）の行番号がラッパー内の行を指してしまう
// （errorTranslator は最後の File "<exec>", line N を採用するため）
const WRAPPER_FILENAME = '<narapy_pygame>'

export interface PygameIO {
  onStdout: (text: string) => void
  onLoading: (text: string) => void
  // pygame.display.set_mode() が返した Surface のサイズ。canvas とモーダルの寸法合わせに使う
  onResize: (width: number, height: number) => void
  // pygame.display.set_caption() で設定されたウィンドウタイトル
  onCaption: (title: string) => void
}

export interface PygameSession {
  // 正常終了・キャンセル時は resolve、Python 例外時は reject
  done: Promise<void>
  cancel: () => void
  // await を書かない同期のゲームループをそのまま動かせるか（JSPI 対応ブラウザ）。
  // false のときは `await asyncio.sleep(0)` でループを回す書き方が必要
  syncLoop: boolean
}

let pyodidePromise: Promise<MainPyodide> | null = null
// loadPyodide の stdout は初期化時に固定されるため、実行ごとに差し替え可能な出力先を経由する
let currentStdout: (text: string) => void = () => {}
let currentResize: (width: number, height: number) => void = () => {}
let currentCaption: (title: string) => void = () => {}
// JSPI（Pyodide の run_sync）が使えるか。ブラウザ依存なので Pyodide 読み込み時に一度だけ確認する
let syncLoopSupported = false
// 前回の実行で FS に書いたファイル。次回の同期で、無くなったものを消すために保持する
let writtenPaths: ReadonlySet<string> = new Set()
// 直近の実行の完了を表す Promise。実行は 1 つずつ直列に行う。モーダルを閉じても停止は協調的・非同期で、
// 古い実行が生きている間に次の実行が FS・canvas・停止フラグへ触ると、2 つのゲームが混ざったり
// 古い停止要求が新しい実行を止めたりする
let runQueue: Promise<void> = Promise.resolve()
// 順番待ちを含め、まだ完了していない実行の数。前の実行が残っているかをモーダルの表示に使う
let activeRuns = 0

const WAITING_MESSAGE = '前の実行の停止を待っています...'

// 起動前にモーダルが閉じられていたときに返す、何もしないセッション
function noopSession(): PygameSession {
  return { done: Promise.resolve(), cancel: () => {}, syncLoop: syncLoopSupported }
}

function loadMainPyodide(onLoading: (text: string) => void): Promise<MainPyodide> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      onLoading('Pygame 用の Python 環境を読み込み中...')
      const { loadPyodide } = (await verifiedImport(
        `${PYODIDE_CDN}pyodide.mjs`,
        PYODIDE_MJS_HASH,
      )) as PyodideModule
      const pyodide = (await loadPyodide({
        indexURL: PYODIDE_CDN,
        stdout: (text) => currentStdout(text),
        stderr: (text) => currentStdout(text),
      })) as MainPyodide
      onLoading('pygame-ce を読み込み中...')
      await pyodide.loadPackage('pygame-ce')
      pyodide.registerJsModule('narapy_host', {
        resize: (width: number, height: number) => currentResize(width, height),
        caption: (title: string) => currentCaption(title),
      })
      pyodide.runPython(BOOTSTRAP_CODE, { filename: WRAPPER_FILENAME })
      syncLoopSupported = (await pyodide.runPythonAsync(CAN_RUN_SYNC_CODE)) === true
      return pyodide
    })().catch((err) => {
      // 失敗した Promise を保持すると以降ずっと再試行できないため破棄する
      pyodidePromise = null
      throw err
    })
  }
  return pyodidePromise
}

// shouldAbort は、起動前にモーダルが閉じられたかを返す。読み込み・順番待ち・ウォッチドッグ起動の
// 待ち時間の間に閉じられた実行を、見えない場所で起動させないために使う
// （起動してから cancel しても、await しかしないコードは停止フラグを見ないので止まらない）。
export async function startPygame(
  code: string,
  canvas: HTMLCanvasElement,
  io: PygameIO,
  project: PygameProject,
  shouldAbort: () => boolean = () => false,
): Promise<PygameSession> {
  // 同期的に（await より前に）自分の順番を確保する。後続の呼び出しは自分の完了を待つ
  const waiting = activeRuns > 0
  activeRuns += 1
  const previous = runQueue
  let resolveSlot!: () => void
  runQueue = new Promise<void>((resolve) => { resolveSlot = resolve })
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    activeRuns -= 1
    resolveSlot()
  }
  try {
    const pyodide = await loadMainPyodide(io.onLoading)
    if (waiting) io.onLoading(WAITING_MESSAGE)
    await previous
    if (shouldAbort()) {
      release()
      return noopSession()
    }
    return await launch(pyodide, code, canvas, io, project, release, shouldAbort)
  } catch (err) {
    release()
    throw err
  }
}

async function launch(
  pyodide: MainPyodide,
  code: string,
  canvas: HTMLCanvasElement,
  io: PygameIO,
  project: PygameProject,
  release: () => void,
  shouldAbort: () => boolean,
): Promise<PygameSession> {
  currentStdout = io.onStdout
  currentResize = io.onResize
  currentCaption = io.onCaption
  pyodide.canvas.setCanvas2D(canvas)
  writtenPaths = syncFiles(pyodide.FS, WORK_DIR, writtenPaths, project.files, project.directories)
  pyodide.runPython(
    `__narapy_pygame_prepare__(${JSON.stringify(WORK_DIR)}, ${JSON.stringify(topLevelPyModuleNames(project.files))})`,
  )
  pyodide.globals.set('__narapy_pygame_src__', code)
  // 同期ループでメインスレッドが固まっても復帰できるよう、別 Worker に心拍を監視させる
  const watchdog = await startWatchdog()
  if (shouldAbort()) {
    watchdog.stop()
    release()
    return noopSession()
  }
  pyodide.setInterruptBuffer(watchdog.interruptBuffer)
  // runPythonAsync 経由で開始する。同期コード全体が JSPI の suspend 可能なスタック上で走り、
  // パッチ済みの flip / tick / event.get が run_sync でブラウザへ制御を返せる
  const run = pyodide.runPythonAsync(RUN_MAIN_CODE, { filename: WRAPPER_FILENAME })

  let cancelled = false
  let finished = false
  const done = Promise.resolve(run)
    .then(() => undefined)
    .catch((err: unknown) => {
      // 停止操作による KeyboardInterrupt / CancelledError は正常な終了として扱う
      if (cancelled) return
      // ウォッチドッグの割り込みによる KeyboardInterrupt は、Python 例外ではなく専用エラーにする
      if (watchdog.wasStalled()) throw new PygameStalledError()
      throw err
    })
    .finally(() => {
      finished = true
      // 終了間際にウォッチドッグが書いた SIGINT を、次の実行の prepare に当てない
      watchdog.interruptBuffer[0] = 0
      watchdog.stop()
      release()
    })

  return {
    done,
    syncLoop: syncLoopSupported,
    cancel: () => {
      if (finished) return
      cancelled = true
      // 同期ループは、パッチ済みの flip / tick / event.get が停止フラグを見て KeyboardInterrupt を
      // 投げて止まる。await で止まっている非同期ループは Task の cancel で止める。
      // interrupt buffer は使わない（yield 中の SIGINT は Pyodide のイベントループ内部に当たって壊れる）。
      // 停止は best effort で、失敗しても呼び出し側（モーダルを閉じる処理）を止めない。
      try {
        pyodide.globals.set(STOP_FLAG, true)
        pyodide.runPython(CANCEL_CODE)
      } catch {
        // 実行がすでに終わっている・Python が再入できない場合は無視する
      }
    },
  }
}
