// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIELD_HEARTBEAT,
  FIELD_HIDDEN,
  FIELD_STALLED,
  HEARTBEAT_INTERVAL_MS,
  INT32_OFFSET,
  READY_TIMEOUT_MS,
  type WatchdogMessage,
} from './watchdog.shared'
import { startWatchdog } from './watchdog'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  messages: WatchdogMessage[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: WatchdogMessage): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  // ウォッチドッグ Worker が監視を始めたときの応答
  replyReady(): void {
    this.onmessage?.({ data: { type: 'ready' } } as MessageEvent)
  }

  fields(): Int32Array {
    const start = this.messages.find((m) => m.type === 'start')
    if (!start || start.type !== 'start') throw new Error('start message not sent')
    return new Int32Array(start.sab, INT32_OFFSET)
  }
}

let hidden = false
function setHidden(value: boolean): void {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('startWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWorker.instances = []
    hidden = false
    vi.stubGlobal('Worker', FakeWorker)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const worker = () => FakeWorker.instances[0]

  it('Worker に start と SharedArrayBuffer を送り、ready の応答まで待つ', async () => {
    let resolved = false
    const promise = startWatchdog().then((w) => { resolved = true; return w })
    await vi.advanceTimersByTimeAsync(0)

    expect(worker().messages[0].type).toBe('start')
    expect(resolved).toBe(false)

    worker().replyReady()
    await promise
    expect(resolved).toBe(true)
  })

  it('応答が無くても、タイムアウトで実行を妨げずに返る', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await expect(promise).resolves.toBeDefined()
  })

  it('Worker の起動に失敗しても返る（監視なしで実行を続ける）', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().onerror?.({} as ErrorEvent)
    await expect(promise).resolves.toBeDefined()
  })

  it('ready を受けたらタイムアウト用のタイマーを残さない', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().replyReady()
    const watchdog = await promise
    watchdog.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('一定間隔で心拍を進める', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().replyReady()
    const watchdog = await promise

    const fields = worker().fields()
    const before = Atomics.load(fields, FIELD_HEARTBEAT)
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3)
    expect(Atomics.load(fields, FIELD_HEARTBEAT)).toBe(before + 3)
    watchdog.stop()
  })

  it('タブの表示状態を共有バッファへ反映する', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().replyReady()
    const watchdog = await promise
    const fields = worker().fields()

    expect(Atomics.load(fields, FIELD_HIDDEN)).toBe(0)
    setHidden(true)
    expect(Atomics.load(fields, FIELD_HIDDEN)).toBe(1)
    setHidden(false)
    expect(Atomics.load(fields, FIELD_HIDDEN)).toBe(0)
    watchdog.stop()
  })

  it('表示に戻った直後に心拍を 1 回進める（間引かれた古い心拍で誤検知しないため）', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().replyReady()
    const watchdog = await promise
    const fields = worker().fields()

    setHidden(true)
    const hiddenCount = Atomics.load(fields, FIELD_HEARTBEAT)
    setHidden(false)
    expect(Atomics.load(fields, FIELD_HEARTBEAT)).toBe(hiddenCount + 1)
    watchdog.stop()
  })

  it('wasStalled は Worker が立てた停止フラグを読む', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().replyReady()
    const watchdog = await promise

    expect(watchdog.wasStalled()).toBe(false)
    Atomics.store(worker().fields(), FIELD_STALLED, 1)
    expect(watchdog.wasStalled()).toBe(true)
    watchdog.stop()
  })

  it('stop で心拍・表示監視を止め、Worker を終了する', async () => {
    const promise = startWatchdog()
    await vi.advanceTimersByTimeAsync(0)
    worker().replyReady()
    const watchdog = await promise
    const fields = worker().fields()

    watchdog.stop()
    expect(worker().messages.at(-1)).toEqual({ type: 'stop' })
    expect(worker().terminated).toBe(true)

    const count = Atomics.load(fields, FIELD_HEARTBEAT)
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3)
    setHidden(true)
    expect(Atomics.load(fields, FIELD_HEARTBEAT)).toBe(count)
    expect(Atomics.load(fields, FIELD_HIDDEN)).toBe(0)
  })
})
