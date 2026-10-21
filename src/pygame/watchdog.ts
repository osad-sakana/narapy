import {
  FIELD_HEARTBEAT,
  FIELD_PAUSED,
  FIELD_STALLED,
  HEARTBEAT_INTERVAL_MS,
  INT32_OFFSET,
  WATCHDOG_SAB_BYTES,
  READY_TIMEOUT_MS,
  type WatchdogMessage,
} from './watchdog.shared'

export interface Watchdog {
  // Pyodide の setInterruptBuffer に渡す（byte 0 が SIGINT）
  interruptBuffer: Uint8Array
  // ウォッチドッグの割り込みで止まったか（通常の停止操作と区別するため）
  wasStalled: () => boolean
  stop: () => void
}

// メインスレッドから定期的に心拍を打ち、別 Worker に見張らせる。
// `while True:` のように await を含まない同期ループでメインスレッドが固まると心拍が止まり、
// Worker が KeyboardInterrupt を注入して復帰させる。
//
// Worker の起動は、メインスレッドが固まった後では間に合わない（起動がメインスレッドの
// 処理待ちになる）ため、監視の開始を確認してから返す。起動に失敗しても実行自体は妨げない。
export async function startWatchdog(): Promise<Watchdog> {
  const sab = new SharedArrayBuffer(WATCHDOG_SAB_BYTES)
  const fields = new Int32Array(sab, INT32_OFFSET)
  const worker = new Worker(new URL('./watchdog.worker.ts', import.meta.url), { type: 'module' })

  const syncVisibility = (): void => {
    Atomics.store(fields, FIELD_PAUSED, document.hidden ? 1 : 0)
  }
  syncVisibility()
  document.addEventListener('visibilitychange', syncVisibility)

  const heartbeat = setInterval(() => Atomics.add(fields, FIELD_HEARTBEAT, 1), HEARTBEAT_INTERVAL_MS)
  const ready = new Promise<void>((resolve) => {
    worker.onmessage = () => resolve()
    worker.onerror = () => resolve()
    setTimeout(resolve, READY_TIMEOUT_MS)
  })
  worker.postMessage({ type: 'start', sab } satisfies WatchdogMessage)
  await ready

  return {
    interruptBuffer: new Uint8Array(sab, 0, 1),
    wasStalled: () => Atomics.load(fields, FIELD_STALLED) === 1,
    stop: () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', syncVisibility)
      worker.postMessage({ type: 'stop' } satisfies WatchdogMessage)
      worker.terminate()
    },
  }
}
