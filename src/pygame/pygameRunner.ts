import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from '../lib/pyodideLoader'
import type { PyodideInterface, PyodideModule } from '../pyodide/pyodideTypes'

// SDL は <canvas> と DOM イベントを必要とするため、Worker ではなくメインスレッドの
// 専用 Pyodide で実行する（issue #73 の PoC）。通常実行の Worker とは完全に分離する。
interface MainPyodide extends PyodideInterface {
  runPython: (code: string) => unknown
  canvas: { setCanvas2D: (canvas: HTMLCanvasElement) => void }
  registerJsModule: (name: string, module: object) => void
}

export interface PygameIO {
  onStdout: (text: string) => void
  onLoading: (text: string) => void
  // pygame.display.set_mode() が返した Surface のサイズ。canvas とモーダルの寸法合わせに使う
  onResize: (width: number, height: number) => void
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
    ns = {'__name__': '__main__'}
    try:
        res = eval(compile(src, '<main>', 'exec', ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), ns)
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
): Promise<PygameSession> {
  const pyodide = await loadMainPyodide(io.onLoading)
  currentStdout = io.onStdout
  currentResize = io.onResize
  pyodide.canvas.setCanvas2D(canvas)
  pyodide.globals.set('__narapy_pygame_src__', code)
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
      throw err
    })
    .finally(() => {
      finished = true
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
