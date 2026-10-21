import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from '../lib/pyodideLoader'
import type { PyodideInterface, PyodideModule } from '../pyodide/pyodideTypes'
import type { RunFile } from '../types'
import { syncFiles, topLevelPyModuleNames } from './fsSync'
import { startWatchdog } from './watchdog'

// SDL は <canvas> と DOM イベントを必要とするため、Worker ではなくメインスレッドの
// 専用 Pyodide で実行する（issue #73 の PoC）。通常実行の Worker とは完全に分離する。
interface MainPyodide extends PyodideInterface {
  runPython: (code: string) => unknown
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
}

// ゲームループは `await asyncio.sleep(0)` でブラウザへ制御を返す前提。
// 例外・キャンセルのどちらでも pygame.quit() を実行して次回実行に状態を持ち越さない。
// import・一時変数は関数内に閉じ込める（グローバルにユーザー変数と衝突する名前を残さない）。
const BOOTSTRAP_CODE = `
# 作業ディレクトリへ移動し、前回実行の直下モジュール（import helper 等）を sys.modules から外して
# 編集後の内容が再 import されるようにする
def __narapy_pygame_prepare__(workdir, names):
    import os, sys, importlib
    os.chdir(workdir)
    for name in names:
        sys.modules.pop(name, None)
    importlib.invalidate_caches()

# ユーザーコードのファイル名は通常実行と同じ "<exec>" にする（エラー翻訳が行番号を
# File "<exec>", line N から抽出するため。別名だとこのラッパー内の行番号を拾ってしまう）
async def __narapy_pygame_main__(src):
    import ast, sys, pygame, narapy_host
    # set_mode は canvas 要素のサイズを変えないため、返した Surface のサイズをホストへ通知する
    if not getattr(pygame.display.set_mode, '__narapy_wrapped__', False):
        orig_set_mode = pygame.display.set_mode
        def set_mode(*args, **kwargs):
            surface = orig_set_mode(*args, **kwargs)
            narapy_host.resize(*surface.get_size())
            return surface
        set_mode.__narapy_wrapped__ = True
        pygame.display.set_mode = set_mode
    if not getattr(pygame.display.set_caption, '__narapy_wrapped__', False):
        orig_set_caption = pygame.display.set_caption
        def set_caption(*args, **kwargs):
            orig_set_caption(*args, **kwargs)
            narapy_host.caption(pygame.display.get_caption()[0])
        set_caption.__narapy_wrapped__ = True
        pygame.display.set_caption = set_caption
    ns = {'__name__': '__main__'}
    try:
        res = eval(compile(src, '<exec>', 'exec', ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), ns)
        if res is not None:
            await res
    finally:
        pg = sys.modules.get('pygame')
        if pg is not None:
            pg.quit()
`

let pyodidePromise: Promise<MainPyodide> | null = null
// loadPyodide の stdout は初期化時に固定されるため、実行ごとに差し替え可能な出力先を経由する
let currentStdout: (text: string) => void = () => {}
let currentResize: (width: number, height: number) => void = () => {}
let currentCaption: (title: string) => void = () => {}
// 前回の実行で FS に書いたファイル。次回の同期で、無くなったものを消すために保持する
let writtenPaths: ReadonlySet<string> = new Set()

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
      pyodide.runPython(BOOTSTRAP_CODE)
      return pyodide
    })().catch((err) => {
      // 失敗した Promise を保持すると以降ずっと再試行できないため破棄する
      pyodidePromise = null
      throw err
    })
  }
  return pyodidePromise
}

export async function startPygame(
  code: string,
  canvas: HTMLCanvasElement,
  io: PygameIO,
  project: PygameProject,
): Promise<PygameSession> {
  const pyodide = await loadMainPyodide(io.onLoading)
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
  pyodide.setInterruptBuffer(watchdog.interruptBuffer)
  // await した PyProxy は Pyodide が破棄するため、キャンセル用に Task を Python 側のグローバルにも保持する
  const task = pyodide.runPython(
    'import asyncio\n__narapy_pygame_task__ = asyncio.ensure_future(__narapy_pygame_main__(__narapy_pygame_src__))\n__narapy_pygame_task__',
  ) as Promise<unknown>

  let cancelled = false
  let finished = false
  const done = Promise.resolve(task)
    .then(() => undefined)
    .catch((err: unknown) => {
      if (cancelled) return
      // ウォッチドッグの割り込みによる KeyboardInterrupt は、Python 例外ではなく専用エラーにする
      if (watchdog.wasStalled()) throw new PygameStalledError()
      throw err
    })
    .finally(() => {
      finished = true
      watchdog.stop()
    })

  return {
    done,
    cancel: () => {
      if (finished) return
      cancelled = true
      pyodide.runPython('__narapy_pygame_task__.cancel()')
    },
  }
}
