import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LintResult } from './result'

const setModelMarkers = vi.fn()
const models: unknown[] = []
vi.mock('monaco-editor', () => ({
  MarkerSeverity: { Warning: 4 },
  editor: {
    setModelMarkers: (...args: unknown[]) => setModelMarkers(...args),
    getModels: () => models,
  },
}))

const requestLint = vi.fn<(code: string) => Promise<LintResult>>()
vi.mock('../editor/completion', () => ({ requestLint: (code: string) => requestLint(code) }))

const { initMissingCallLint } = await import('./controller')

const warning = { name: 'print', kind: 'expr', line: 1, col: 1, endCol: 6 } as const

interface FakeModel { value: string; version: number; getValue: () => string; getVersionId: () => number }

function makeModel(value: string): FakeModel {
  const m: FakeModel = { value, version: 1, getValue: () => m.value, getVersionId: () => m.version }
  return m
}

function setup(opts: { path?: string; suppressed?: boolean } = {}) {
  const model = makeModel('print')
  const state = { model: model as FakeModel | null, path: opts.path ?? 'main.py', suppressed: opts.suppressed ?? false }
  let onContent: () => void = () => {}
  let onModel: () => void = () => {}
  const editor = {
    getModel: () => state.model,
    onDidChangeModelContent: (cb: () => void) => { onContent = cb },
    onDidChangeModel: (cb: () => void) => { onModel = cb },
  }
  const lint = initMissingCallLint({
    editor: editor as never,
    getEditorPath: () => state.path,
    isSuppressed: () => state.suppressed,
  })
  return { lint, state, model, fireContent: () => onContent(), fireModel: () => onModel() }
}

const flush = async (): Promise<void> => { await vi.advanceTimersByTimeAsync(0) }
const lastMarkers = (): unknown[] => setModelMarkers.mock.calls.at(-1)?.[2] as unknown[]

describe('initMissingCallLint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setModelMarkers.mockReset()
    requestLint.mockReset()
    requestLint.mockResolvedValue({ status: 'ok', warnings: [warning] })
    models.length = 0
  })
  afterEach(() => vi.useRealTimers())

  it('初期化時に検査して黄色の波線（Warning）を付ける', async () => {
    const { model } = setup()
    await flush()
    expect(setModelMarkers).toHaveBeenCalledWith(model, 'narapy.missingCall', [
      expect.objectContaining({ severity: 4, startLineNumber: 1, startColumn: 1, endColumn: 6 }),
    ])
  })

  it('編集後は 500ms の debounce を待ってから検査する', async () => {
    const { fireContent } = setup()
    await flush()
    requestLint.mockClear()
    fireContent()
    await vi.advanceTimersByTimeAsync(499)
    expect(requestLint).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(requestLint).toHaveBeenCalledTimes(1)
  })

  it('連続して編集すると最後の 1 回だけ検査する', async () => {
    const { fireContent } = setup()
    await flush()
    requestLint.mockClear()
    fireContent()
    await vi.advanceTimersByTimeAsync(300)
    fireContent()
    await vi.advanceTimersByTimeAsync(500)
    expect(requestLint).toHaveBeenCalledTimes(1)
  })

  it('.py 以外のファイルは検査せず波線を消す', async () => {
    const { model } = setup({ path: 'data.csv' })
    await flush()
    expect(requestLint).not.toHaveBeenCalled()
    expect(setModelMarkers).toHaveBeenCalledWith(model, 'narapy.missingCall', [])
  })

  it('構文エラー・失敗の結果は波線を消す', async () => {
    requestLint.mockResolvedValue({ status: 'syntax_error' })
    setup()
    await flush()
    expect(lastMarkers()).toEqual([])
  })

  it('応答を待つ間に編集された結果は捨てる（stale）', async () => {
    let resolve: (r: LintResult) => void = () => {}
    requestLint.mockReturnValue(new Promise<LintResult>((r) => { resolve = r }))
    const { model } = setup()
    model.version = 2
    resolve({ status: 'ok', warnings: [warning] })
    await flush()
    expect(setModelMarkers).not.toHaveBeenCalled()
  })

  it('応答を待つ間にモデルが切り替わった結果は捨てる', async () => {
    let resolve: (r: LintResult) => void = () => {}
    requestLint.mockReturnValue(new Promise<LintResult>((r) => { resolve = r }))
    const { state } = setup()
    state.model = makeModel('other')
    resolve({ status: 'ok', warnings: [warning] })
    await flush()
    expect(setModelMarkers).not.toHaveBeenCalled()
  })

  it('応答が届く前に講師モードが ON になったら波線を出さない', async () => {
    let resolve: (r: LintResult) => void = () => {}
    requestLint.mockReturnValue(new Promise<LintResult>((r) => { resolve = r }))
    const { state, model } = setup()
    state.suppressed = true
    resolve({ status: 'ok', warnings: [warning] })
    await flush()
    expect(setModelMarkers).toHaveBeenCalledTimes(1)
    expect(setModelMarkers).toHaveBeenCalledWith(model, 'narapy.missingCall', [])
  })

  it('superseded の結果は何も反映しない', async () => {
    requestLint.mockResolvedValue({ status: 'superseded' })
    setup()
    await flush()
    expect(setModelMarkers).not.toHaveBeenCalled()
  })

  it('講師モード ON で全モデルの波線を消し、OFF で検査し直す', async () => {
    const other = makeModel('x')
    models.push(other)
    const { lint, state } = setup()
    await flush()
    requestLint.mockClear()
    setModelMarkers.mockClear()

    state.suppressed = true
    lint.onSuppressedChanged()
    expect(setModelMarkers).toHaveBeenCalledWith(other, 'narapy.missingCall', [])
    expect(lint.getRunWarnings()).toEqual([])

    state.suppressed = false
    lint.onSuppressedChanged()
    await flush()
    expect(requestLint).toHaveBeenCalledTimes(1)
  })

  it('講師モード中は検査しない', async () => {
    setup({ suppressed: true })
    await flush()
    expect(requestLint).not.toHaveBeenCalled()
  })
})

describe('起動待ちの再試行', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    requestLint.mockReset()
    setModelMarkers.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('初回が timeout でも、内容が変わっていなければ検査し直して波線を出す', async () => {
    requestLint
      .mockResolvedValueOnce({ status: 'timeout' })
      .mockResolvedValue({ status: 'ok', warnings: [warning] })
    setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(requestLint).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(requestLint).toHaveBeenCalledTimes(2)
    expect(lastMarkers()).toHaveLength(1)
  })

  it('再試行は回数に上限がある', async () => {
    requestLint.mockResolvedValue({ status: 'unavailable' })
    setup()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(requestLint).toHaveBeenCalledTimes(7)
  })
})

describe('getRunWarnings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    requestLint.mockReset()
    requestLint.mockResolvedValue({ status: 'ok', warnings: [warning] })
    setModelMarkers.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('検査結果が現在の内容と一致していれば行番号つきのログを返す', async () => {
    const { lint } = setup()
    await flush()
    expect(lint.getRunWarnings()).toEqual([expect.stringMatching(/^\[警告\] 1行目: /)])
  })

  it('編集後で検査が追いついていなければ返さない', async () => {
    const { lint, model } = setup()
    await flush()
    model.version = 2
    expect(lint.getRunWarnings()).toEqual([])
  })
})
