import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifiedImport = vi.fn()
vi.mock('../lib/pyodideLoader', () => ({
  PYODIDE_CDN: 'https://cdn.example/pyodide/',
  PYODIDE_MJS_HASH: 'sha384-test',
  verifiedImport: (...args: unknown[]) => verifiedImport(...args),
}))

const watchdog = {
  interruptBuffer: new Uint8Array(1),
  wasStalled: vi.fn(() => false),
  stop: vi.fn(),
}
const startWatchdog = vi.fn(async () => watchdog)
vi.mock('./watchdog', () => ({
  startWatchdog: () => startWatchdog(),
}))

interface Deferred {
  promise: Promise<unknown>
  resolve: (v?: unknown) => void
  reject: (e: unknown) => void
}

function deferred(): Deferred {
  let resolve!: (v?: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createFakeFs() {
  const dirs = new Set<string>(['/', '/home'])
  const files = new Map<string, string | Uint8Array>()
  return {
    dirs,
    files,
    analyzePath: (path: string) => ({ exists: dirs.has(path) || files.has(path) }),
    mkdir: (path: string) => { dirs.add(path) },
    writeFile: (path: string, data: string | Uint8Array) => { files.set(path, data) },
    unlink: (path: string) => { files.delete(path) },
  }
}

// loadPyodide が返す偽の Pyodide。ゲーム本体を走らせる runPythonAsync だけ制御可能な Promise を返す
// （JSPI の可否を確認する can_run_sync の呼び出しは canRunSync を即座に返す）
function createFakePyodide(canRunSync: boolean) {
  const task = deferred()
  const jsModules: Record<string, Record<string, (...args: never[]) => void>> = {}
  const pyodide = {
    loadPackage: vi.fn(async () => {}),
    registerJsModule: vi.fn((name: string, mod: Record<string, (...args: never[]) => void>) => {
      jsModules[name] = mod
    }),
    canvas: { setCanvas2D: vi.fn() },
    globals: { set: vi.fn(), get: vi.fn() },
    FS: createFakeFs(),
    setInterruptBuffer: vi.fn(),
    runPython: vi.fn((_code: string): unknown => undefined),
    runPythonAsync: vi.fn((code: string) =>
      code.includes('can_run_sync') ? Promise.resolve(canRunSync) : task.promise,
    ),
  }
  return { pyodide, task, jsModules }
}

async function setup(canRunSync = true) {
  vi.resetModules()
  verifiedImport.mockReset()
  const fake = createFakePyodide(canRunSync)
  let stdout: ((text: string) => void) | undefined
  const loadPyodide = vi.fn(async (opts: { stdout: (text: string) => void }) => {
    stdout = opts.stdout
    return fake.pyodide
  })
  verifiedImport.mockResolvedValue({ loadPyodide })
  const mod = await import('./pygameRunner')
  return { mod, fake, loadPyodide, emitStdout: (t: string) => stdout?.(t) }
}

function createIO() {
  return {
    onStdout: vi.fn(),
    onLoading: vi.fn(),
    onResize: vi.fn(),
    onCaption: vi.fn(),
  }
}

const canvas = {} as HTMLCanvasElement
const emptyProject = { files: [], directories: [] }

describe('startPygame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    watchdog.wasStalled.mockReturnValue(false)
    watchdog.interruptBuffer[0] = 0
  })

  it('SRI 検証つきで Pyodide を読み込み、pygame-ce を導入してから実行する', async () => {
    const { mod, fake } = await setup()
    const io = createIO()
    await mod.startPygame('import pygame', canvas, io, emptyProject)

    expect(verifiedImport).toHaveBeenCalledWith('https://cdn.example/pyodide/pyodide.mjs', 'sha384-test')
    expect(fake.pyodide.loadPackage).toHaveBeenCalledWith('pygame-ce')
    expect(io.onLoading).toHaveBeenCalledTimes(2)
    expect(fake.pyodide.canvas.setCanvas2D).toHaveBeenCalledWith(canvas)
    expect(fake.pyodide.globals.set).toHaveBeenCalledWith('__narapy_pygame_src__', 'import pygame')
  })

  it('2 回目以降は Pyodide を再読み込みしない', async () => {
    const { mod, fake, loadPyodide } = await setup()
    const first = await mod.startPygame('a', canvas, createIO(), emptyProject)
    fake.task.resolve()
    await first.done
    await mod.startPygame('b', canvas, createIO(), emptyProject)
    expect(loadPyodide).toHaveBeenCalledTimes(1)
  })

  it('標準出力は直近の実行の onStdout に流れる', async () => {
    const { mod, fake, emitStdout } = await setup()
    const first = createIO()
    const second = createIO()
    const firstSession = await mod.startPygame('a', canvas, first, emptyProject)
    fake.task.resolve()
    await firstSession.done
    await mod.startPygame('b', canvas, second, emptyProject)
    emitStdout('hello')
    expect(first.onStdout).not.toHaveBeenCalled()
    expect(second.onStdout).toHaveBeenCalledWith('hello')
  })

  it('Python 側の set_mode / set_caption 通知を直近の実行のコールバックへ中継する', async () => {
    const { mod, fake } = await setup()
    const io = createIO()
    await mod.startPygame('a', canvas, io, emptyProject)
    const host = fake.jsModules['narapy_host']
    host.resize(480 as never, 320 as never)
    host.caption('My Game' as never)
    expect(io.onResize).toHaveBeenCalledWith(480, 320)
    expect(io.onCaption).toHaveBeenCalledWith('My Game')
  })

  it('スクリプトが正常終了すると done が resolve する', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    fake.task.resolve()
    await expect(session.done).resolves.toBeUndefined()
  })

  it('Python 例外は done の reject として伝わる', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    fake.task.reject(new Error('NameError: x'))
    await expect(session.done).rejects.toThrow('NameError: x')
  })

  it('cancel は停止フラグを立て（同期ループ用）、Task を cancel する（非同期ループ用）', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    session.cancel()
    expect(fake.pyodide.globals.set).toHaveBeenCalledWith('__narapy_pygame_stop__', true)
    expect(fake.pyodide.runPython).toHaveBeenCalledWith('__narapy_pygame_cancel__()')
  })

  it('cancel では interrupt buffer に書かない（イベントループ内部に当たって壊れるため）', async () => {
    const { mod } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    session.cancel()
    expect(watchdog.interruptBuffer[0]).toBe(0)
  })

  it('cancel が内部で失敗しても例外を投げない（モーダルを必ず閉じられるように）', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    fake.pyodide.runPython.mockImplementation((() => { throw new Error('boom') }) as never)
    expect(() => session.cancel()).not.toThrow()
  })

  it('cancel の結果として起きる例外（KeyboardInterrupt / CancelledError）は握りつぶす', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    session.cancel()
    fake.task.reject(new Error('pyodide.ffi.ConversionError: Conversion from python to javascript failed'))
    await expect(session.done).resolves.toBeUndefined()
  })

  it('終了後の cancel は何もしない（古い SIGINT を残さない）', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    fake.task.resolve()
    await session.done
    fake.pyodide.runPython.mockClear()
    fake.pyodide.globals.set.mockClear()
    session.cancel()
    expect(fake.pyodide.runPython).not.toHaveBeenCalled()
    expect(fake.pyodide.globals.set).not.toHaveBeenCalled()
  })

  it('ゲームは runPythonAsync 経由で開始する（JSPI の run_sync が使えるスタックにするため）', async () => {
    const { mod, fake } = await setup()
    await mod.startPygame('a', canvas, createIO(), emptyProject)
    expect(fake.pyodide.runPythonAsync).toHaveBeenCalledWith(
      'await __narapy_pygame_main__(__narapy_pygame_src__)',
      { filename: '<narapy_pygame>' },
    )
  })

  it('ブートストラップとゲーム開始は <exec> 以外のファイル名で実行する（エラー行番号がユーザーコードを指すように）', async () => {
    const { mod, fake } = await setup()
    await mod.startPygame('a', canvas, createIO(), emptyProject)
    expect(fake.pyodide.runPython).toHaveBeenCalledWith(
      expect.stringContaining('__narapy_install_sync_patches__'),
      { filename: '<narapy_pygame>' },
    )
  })

  it('JSPI が使えるブラウザでは syncLoop が true になる', async () => {
    const { mod } = await setup(true)
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    expect(session.syncLoop).toBe(true)
  })

  it('JSPI が使えないブラウザでは syncLoop が false になる（async 方式にフォールバック）', async () => {
    const { mod } = await setup(false)
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    expect(session.syncLoop).toBe(false)
  })

  it('読み込みに失敗しても次回は再試行できる', async () => {
    const { mod, loadPyodide } = await setup()
    loadPyodide.mockRejectedValueOnce(new Error('network'))
    await expect(mod.startPygame('a', canvas, createIO(), emptyProject)).rejects.toThrow('network')
    await expect(mod.startPygame('a', canvas, createIO(), emptyProject)).resolves.toBeDefined()
    expect(loadPyodide).toHaveBeenCalledTimes(2)
  })

  it('ウォッチドッグの interrupt buffer を Pyodide に設定する', async () => {
    const { mod, fake } = await setup()
    await mod.startPygame('a', canvas, createIO(), emptyProject)
    expect(startWatchdog).toHaveBeenCalledTimes(1)
    expect(fake.pyodide.setInterruptBuffer).toHaveBeenCalledWith(watchdog.interruptBuffer)
  })

  it('終了時（正常・例外・キャンセル）にウォッチドッグを止める', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    expect(watchdog.stop).not.toHaveBeenCalled()
    fake.task.resolve()
    await session.done
    expect(watchdog.stop).toHaveBeenCalledTimes(1)
  })

  it('ウォッチドッグに止められた場合は PygameStalledError で reject する', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    watchdog.wasStalled.mockReturnValue(true)
    fake.task.reject(new Error('KeyboardInterrupt'))
    await expect(session.done).rejects.toBeInstanceOf(mod.PygameStalledError)
    expect(watchdog.stop).toHaveBeenCalledTimes(1)
  })

  it('ユーザーの停止操作を優先し、cancel 後は PygameStalledError にしない', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    session.cancel()
    watchdog.wasStalled.mockReturnValue(true)
    fake.task.reject(new Error('CancelledError'))
    await expect(session.done).resolves.toBeUndefined()
  })

  describe('エクスプローラー上のファイル', () => {
    const project = {
      files: [
        { kind: 'text' as const, path: 'main.py', data: 'import pygame' },
        { kind: 'text' as const, path: 'helper.py', data: 'X = 1' },
        { kind: 'binary' as const, path: 'assets/player.png', data: new Uint8Array([1, 2, 3]) },
      ],
      directories: ['assets', 'empty'],
    }

    it('画像等のバイナリも含めて作業ディレクトリへ書き込んでから実行する', async () => {
      const { mod, fake } = await setup()
      await mod.startPygame('x', canvas, createIO(), project)

      expect(fake.pyodide.FS.files.get('/home/pyodide/assets/player.png')).toEqual(new Uint8Array([1, 2, 3]))
      expect(fake.pyodide.FS.files.get('/home/pyodide/helper.py')).toBe('X = 1')
      expect(fake.pyodide.FS.dirs.has('/home/pyodide/empty')).toBe(true)
    })

    it('作業ディレクトリへ移動し、直下の .py モジュールのキャッシュを掃除する', async () => {
      const { mod, fake } = await setup()
      await mod.startPygame('x', canvas, createIO(), project)

      const prepare = fake.pyodide.runPython.mock.calls
        .map(([code]) => code as string)
        .find((code) => code.startsWith('__narapy_pygame_prepare__('))
      expect(prepare).toBe('__narapy_pygame_prepare__("/home/pyodide", ["main","helper"])')
    })

    it('実行前（ゲーム Task の開始前）にファイルを書き込む', async () => {
      const { mod, fake } = await setup()
      const order: string[] = []
      fake.pyodide.FS.writeFile = ((path: string) => { order.push(`write:${path}`) }) as never
      fake.pyodide.runPythonAsync.mockImplementation(((code: string) => {
        if (code.includes('can_run_sync')) return Promise.resolve(true)
        order.push('task')
        return fake.task.promise
      }) as never)
      await mod.startPygame('x', canvas, createIO(), project)

      expect(order.indexOf('write:/home/pyodide/assets/player.png')).toBeLessThan(order.indexOf('task'))
    })

    it('2 回目の実行では、無くなったアセットを FS から消す', async () => {
      const { mod, fake } = await setup()
      const first = await mod.startPygame('x', canvas, createIO(), project)
      fake.task.resolve()
      await first.done
      await mod.startPygame('x', canvas, createIO(), {
        files: [{ kind: 'text', path: 'main.py', data: 'import pygame' }],
        directories: [],
      })

      expect(fake.pyodide.FS.files.has('/home/pyodide/assets/player.png')).toBe(false)
      expect(fake.pyodide.FS.files.has('/home/pyodide/main.py')).toBe(true)
    })
  })

  describe('実行の直列化', () => {
    // 呼び出しごとに別の Promise を返し、各 run の終了を個別に制御できる偽 Pyodide
    async function setupSerial() {
      const ctx = await setup()
      const runs: Deferred[] = []
      ctx.fake.pyodide.runPythonAsync.mockImplementation(((code: string) => {
        if (code.includes('can_run_sync')) return Promise.resolve(true)
        const d = deferred()
        runs.push(d)
        return d.promise
      }) as never)
      return { ...ctx, runs }
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

    it('前の実行が終わるまで、次の実行は FS・停止フラグ・ソースに触れない', async () => {
      const { mod, fake, runs } = await setupSerial()
      const first = await mod.startPygame('first', canvas, createIO(), emptyProject)

      const secondPromise = mod.startPygame('second', canvas, createIO(), emptyProject)
      await flush()
      expect(runs).toHaveLength(1)
      expect(fake.pyodide.globals.set).not.toHaveBeenCalledWith('__narapy_pygame_src__', 'second')

      runs[0].resolve()
      await first.done
      const second = await secondPromise
      expect(runs).toHaveLength(2)
      expect(fake.pyodide.globals.set).toHaveBeenCalledWith('__narapy_pygame_src__', 'second')
      second.cancel()
    })

    it('前の実行が例外で終わっても、次の実行は開始できる', async () => {
      const { mod, runs } = await setupSerial()
      const first = await mod.startPygame('first', canvas, createIO(), emptyProject)
      const secondPromise = mod.startPygame('second', canvas, createIO(), emptyProject)

      runs[0].reject(new Error('NameError: x'))
      await expect(first.done).rejects.toThrow('NameError: x')
      await expect(secondPromise).resolves.toBeDefined()
    })

    it('前の実行の開始（読み込み）が失敗しても、次の実行は待たされ続けない', async () => {
      const { mod, loadPyodide } = await setupSerial()
      loadPyodide.mockRejectedValueOnce(new Error('network'))
      // 同時に始めた 2 つは同じ読み込みの失敗を共有するが、どちらも待たされ続けない
      const firstPromise = mod.startPygame('first', canvas, createIO(), emptyProject)
      const secondPromise = mod.startPygame('second', canvas, createIO(), emptyProject)
      await expect(firstPromise).rejects.toThrow('network')
      await expect(secondPromise).rejects.toThrow('network')

      // 失敗した実行が順番を握ったままにならず、その後の実行は開始できる
      await expect(mod.startPygame('third', canvas, createIO(), emptyProject)).resolves.toBeDefined()
    })

    it('モーダルが閉じられている（abort）場合は、順番が来ても実行を起動しない', async () => {
      const { mod, fake, runs } = await setupSerial()
      const io = createIO()
      const session = await mod.startPygame('x', canvas, io, emptyProject, () => true)

      await expect(session.done).resolves.toBeUndefined()
      expect(runs).toHaveLength(0)
      expect(fake.pyodide.globals.set).not.toHaveBeenCalledWith('__narapy_pygame_src__', 'x')
      expect(startWatchdog).not.toHaveBeenCalled()
      expect(() => session.cancel()).not.toThrow()
    })

    it('順番待ちの間に閉じられた実行は起動せず、後続の実行を妨げない', async () => {
      const { mod, runs } = await setupSerial()
      const first = await mod.startPygame('first', canvas, createIO(), emptyProject)
      let closed = false
      const queued = mod.startPygame('queued', canvas, createIO(), emptyProject, () => closed)
      const third = mod.startPygame('third', canvas, createIO(), emptyProject)
      await flush()

      closed = true
      runs[0].resolve()
      await first.done
      const queuedSession = await queued
      await expect(queuedSession.done).resolves.toBeUndefined()

      await third
      expect(runs).toHaveLength(2) // first と third だけが起動した
    })

    it('ウォッチドッグの起動を待つ間に閉じられた場合も、実行を起動せず後始末する', async () => {
      const { mod, runs } = await setupSerial()
      // 1 回目の確認（順番待ちの後）は通り、2 回目（ウォッチドッグ起動後）で閉じられている
      const checks = [false, true]
      const session = await mod.startPygame('x', canvas, createIO(), emptyProject, () => checks.shift() ?? true)

      await expect(session.done).resolves.toBeUndefined()
      expect(runs).toHaveLength(0)
      expect(watchdog.stop).toHaveBeenCalledTimes(1)
      // 順番を握ったままにならない
      await expect(mod.startPygame('next', canvas, createIO(), emptyProject)).resolves.toBeDefined()
    })

    it('前の実行が残っている間は、順番待ちであることを読み込み表示で知らせる', async () => {
      const { mod, runs } = await setupSerial()
      await mod.startPygame('first', canvas, createIO(), emptyProject)
      const io = createIO()
      const queued = mod.startPygame('second', canvas, io, emptyProject)
      await flush()

      expect(io.onLoading).toHaveBeenCalledWith('前の実行の停止を待っています...')
      runs[0].resolve()
      await queued
    })

    it('前の実行が無いときは順番待ちの表示を出さない', async () => {
      const { mod } = await setupSerial()
      const io = createIO()
      await mod.startPygame('first', canvas, io, emptyProject)
      expect(io.onLoading).not.toHaveBeenCalledWith('前の実行の停止を待っています...')
    })
  })

  it('実行が終わったら、ウォッチドッグが残した SIGINT を次の実行へ持ち越さない', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO(), emptyProject)
    watchdog.interruptBuffer[0] = 2
    fake.task.resolve()
    await session.done
    expect(watchdog.interruptBuffer[0]).toBe(0)
  })
})
