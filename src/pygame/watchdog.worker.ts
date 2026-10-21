/// <reference lib="webworker" />

import { nextStallState, INITIAL_STALL_STATE } from './stallMonitor'
import {
  FIELD_HEARTBEAT,
  FIELD_HIDDEN,
  FIELD_STALLED,
  HEARTBEAT_INTERVAL_MS,
  HIDDEN_STALL_MS,
  INT32_OFFSET,
  SIGINT,
  STALL_MS,
  type WatchdogMessage,
  type WatchdogReply,
} from './watchdog.shared'

// ブロック中のメインスレッドは停止ボタンを処理できないため、別スレッドから見張る。
// 心拍が止まったら interrupt buffer に SIGINT を書き、Python 側に KeyboardInterrupt を起こさせる。
let timer: ReturnType<typeof setInterval> | null = null

self.onmessage = (event: MessageEvent<WatchdogMessage>) => {
  const msg = event.data
  if (msg.type === 'stop') {
    if (timer !== null) clearInterval(timer)
    timer = null
    return
  }

  const interrupt = new Uint8Array(msg.sab, 0, 1)
  const fields = new Int32Array(msg.sab, INT32_OFFSET)
  let state = INITIAL_STALL_STATE

  if (timer !== null) clearInterval(timer)
  timer = setInterval(() => {
    const result = nextStallState(
      state,
      Date.now(),
      Atomics.load(fields, FIELD_HEARTBEAT),
      Atomics.load(fields, FIELD_HIDDEN) === 1,
      STALL_MS,
      HIDDEN_STALL_MS,
    )
    state = result.state
    if (result.stalled) {
      Atomics.store(fields, FIELD_STALLED, 1)
      Atomics.store(interrupt, 0, SIGINT)
    }
  }, HEARTBEAT_INTERVAL_MS)
  self.postMessage({ type: 'ready' } satisfies WatchdogReply)
}
