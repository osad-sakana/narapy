import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifiedImport = vi.fn()
vi.mock('../lib/pyodideLoader', () => ({
  PYODIDE_CDN: 'https://cdn.example/pyodide/',
  PYODIDE_MJS_HASH: 'sha384-test',
  verifiedImport: (...args: unknown[]) => verifiedImport(...args),
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

// loadPyodide が返す偽の Pyodide。ensure_future を呼ぶ runPython だけ制御可能な Task を返す
function createFakePyodide() {
  const task = deferred()
  const jsModules: Record<string, Record<string, (...args: never[]) => void>> = {}
  const pyodide = {
    loadPackage: vi.fn(async () => {}),
    registerJsModule: vi.fn((name: string, mod: Record<string, (...args: never[]) => void>) => {
      jsModules[name] = mod
    }),
    canvas: { setCanvas2D: vi.fn() },
    globals: { set: vi.fn(), get: vi.fn() },
    runPython: vi.fn((code: string) => (code.includes('ensure_future') ? task.promise : undefined)),
  }
  return { pyodide, task, jsModules }
}

async function setup() {
  vi.resetModules()
  verifiedImport.mockReset()
  const fake = createFakePyodide()
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

describe('startPygame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SRI 検証つきで Pyodide を読み込み、pygame-ce を導入してから実行する', async () => {
    const { mod, fake } = await setup()
    const io = createIO()
    await mod.startPygame('import pygame', canvas, io)

    expect(verifiedImport).toHaveBeenCalledWith('https://cdn.example/pyodide/pyodide.mjs', 'sha384-test')
    expect(fake.pyodide.loadPackage).toHaveBeenCalledWith('pygame-ce')
    expect(io.onLoading).toHaveBeenCalledTimes(2)
    expect(fake.pyodide.canvas.setCanvas2D).toHaveBeenCalledWith(canvas)
    expect(fake.pyodide.globals.set).toHaveBeenCalledWith('__narapy_pygame_src__', 'import pygame')
  })

  it('2 回目以降は Pyodide を再読み込みしない', async () => {
    const { mod, loadPyodide } = await setup()
    await mod.startPygame('a', canvas, createIO())
    await mod.startPygame('b', canvas, createIO())
    expect(loadPyodide).toHaveBeenCalledTimes(1)
  })

  it('標準出力は直近の実行の onStdout に流れる', async () => {
    const { mod, emitStdout } = await setup()
    const first = createIO()
    const second = createIO()
    await mod.startPygame('a', canvas, first)
    await mod.startPygame('b', canvas, second)
    emitStdout('hello')
    expect(first.onStdout).not.toHaveBeenCalled()
    expect(second.onStdout).toHaveBeenCalledWith('hello')
  })

  it('Python 側の set_mode / set_caption 通知を直近の実行のコールバックへ中継する', async () => {
    const { mod, fake } = await setup()
    const io = createIO()
    await mod.startPygame('a', canvas, io)
    const host = fake.jsModules['narapy_host']
    host.resize(480 as never, 320 as never)
    host.caption('My Game' as never)
    expect(io.onResize).toHaveBeenCalledWith(480, 320)
    expect(io.onCaption).toHaveBeenCalledWith('My Game')
  })

  it('スクリプトが正常終了すると done が resolve する', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO())
    fake.task.resolve()
    await expect(session.done).resolves.toBeUndefined()
  })

  it('Python 例外は done の reject として伝わる', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO())
    fake.task.reject(new Error('NameError: x'))
    await expect(session.done).rejects.toThrow('NameError: x')
  })

  it('cancel は Task を cancel し、その結果の CancelledError は握りつぶす', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO())
    session.cancel()
    expect(fake.pyodide.runPython).toHaveBeenCalledWith('__narapy_pygame_task__.cancel()')
    fake.task.reject(new Error('CancelledError'))
    await expect(session.done).resolves.toBeUndefined()
  })

  it('終了後の cancel は何もしない', async () => {
    const { mod, fake } = await setup()
    const session = await mod.startPygame('a', canvas, createIO())
    fake.task.resolve()
    await session.done
    fake.pyodide.runPython.mockClear()
    session.cancel()
    expect(fake.pyodide.runPython).not.toHaveBeenCalled()
  })

  it('読み込みに失敗しても次回は再試行できる', async () => {
    const { mod, loadPyodide } = await setup()
    loadPyodide.mockRejectedValueOnce(new Error('network'))
    await expect(mod.startPygame('a', canvas, createIO())).rejects.toThrow('network')
    await expect(mod.startPygame('a', canvas, createIO())).resolves.toBeDefined()
    expect(loadPyodide).toHaveBeenCalledTimes(2)
  })
})
