import { beforeEach, describe, expect, it, vi } from 'vitest'

const showInlineInput = vi.fn()
const appendLog = vi.fn()
const setRunStatus = vi.fn()

vi.mock('./inputPrompt', () => ({ showInlineInput: (...a: unknown[]) => showInlineInput(...a) }))
vi.mock('./log', () => ({ appendLog: (...a: unknown[]) => appendLog(...a) }))
vi.mock('./runStatus', () => ({ setRunStatus: (...a: unknown[]) => setRunStatus(...a) }))

import { handleInputRequest, type InputRequestDeps } from './inputRequest'

function setup(overrides: Partial<InputRequestDeps> = {}) {
  const buffers = {
    status: new Int32Array(new SharedArrayBuffer(4 + 16), 0, 1),
    data: new Uint8Array(new SharedArrayBuffer(16)),
  }
  const deps: InputRequestDeps = {
    getBuffers: () => buffers,
    isRunning: () => true,
    pauseTimeout: vi.fn(),
    resumeTimeout: vi.fn(),
    ensureLogVisible: vi.fn(),
    consumeTraceNote: vi.fn(() => true),
    onOpen: vi.fn(),
    ...overrides,
  }
  return { buffers, deps }
}

const answer = (value: string) => ({ value, bytes: new TextEncoder().encode(value) })

describe('handleInputRequest', () => {
  beforeEach(() => {
    showInlineInput.mockReset()
    appendLog.mockReset()
    setRunStatus.mockReset()
  })

  it('入力中はタイムアウトを止め、ログを開き、待機ステータスにする', async () => {
    const { deps } = setup()
    showInlineInput.mockResolvedValue(answer('x'))
    await handleInputRequest(deps, '> ', null)
    expect(deps.pauseTimeout).toHaveBeenCalledOnce()
    expect(deps.ensureLogVisible).toHaveBeenCalledOnce()
    expect(setRunStatus.mock.calls[0]).toEqual(['waiting'])
  })

  it('確定した値を SAB に書き、実行中ならタイムアウトを再開して running に戻す', async () => {
    const { deps, buffers } = setup()
    showInlineInput.mockResolvedValue(answer('abc'))
    await handleInputRequest(deps, '> ', null)
    expect(Atomics.load(buffers.status, 0)).toBe(3)
    expect(Array.from(buffers.data.slice(0, 3))).toEqual([97, 98, 99])
    expect(deps.resumeTimeout).toHaveBeenCalledOnce()
    expect(setRunStatus).toHaveBeenLastCalledWith('running')
  })

  it('キャンセル(null)は -1 を書く', async () => {
    const { deps, buffers } = setup()
    showInlineInput.mockResolvedValue(null)
    await handleInputRequest(deps, '> ', null)
    expect(Atomics.load(buffers.status, 0)).toBe(-1)
  })

  it('hardStop 後(バッファなし)は何も書かない', async () => {
    const { deps, buffers } = setup({ getBuffers: () => null, isRunning: () => false })
    showInlineInput.mockResolvedValue(null)
    await handleInputRequest(deps, '> ', null)
    expect(Atomics.load(buffers.status, 0)).toBe(0)
  })

  it('実行中でなければタイムアウトを再開せず idle に戻す', async () => {
    const { deps } = setup({ isRunning: () => false })
    showInlineInput.mockResolvedValue(answer('a'))
    await handleInputRequest(deps, '> ', null)
    expect(deps.resumeTimeout).not.toHaveBeenCalled()
    expect(setRunStatus).toHaveBeenLastCalledWith('idle')
  })

  it('通常実行(preview=null)ではエコーをログに直接出さない', async () => {
    const { deps } = setup()
    showInlineInput.mockResolvedValue(answer('太郎'))
    await handleInputRequest(deps, '名前: ', null)
    expect(appendLog).not.toHaveBeenCalled()
  })

  it('ステップ実行(preview あり)では未表示出力・注記・エコーをログに出す', async () => {
    const { deps } = setup()
    showInlineInput.mockResolvedValue(answer('太郎'))
    await handleInputRequest(deps, '名前: ', 'menu\n')
    const texts = appendLog.mock.calls.map((c) => c[0])
    expect(texts[0]).toBe('menu')
    expect(texts[1]).toContain('ステップ再生')
    expect(texts.filter((t) => t === '名前: 太郎')).toHaveLength(1)
  })

  it('注記は consumeTraceNote が false なら出さない', async () => {
    const { deps } = setup({ consumeTraceNote: vi.fn(() => false) })
    showInlineInput.mockResolvedValue(answer('a'))
    await handleInputRequest(deps, '> ', '')
    expect(appendLog.mock.calls.map((c) => c[0])).toEqual(['> a'])
  })
})
