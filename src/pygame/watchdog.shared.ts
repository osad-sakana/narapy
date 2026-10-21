// ウォッチドッグ Worker とメインスレッドが共有する SharedArrayBuffer のレイアウト。
// byte 0 は Pyodide の interrupt buffer（2 を書くと KeyboardInterrupt）、
// 4 バイト目以降は Int32 のフィールド。
export const WATCHDOG_SAB_BYTES = 16
export const INT32_OFFSET = 4
export const FIELD_HEARTBEAT = 0
export const FIELD_PAUSED = 1
export const FIELD_STALLED = 2

export const SIGINT = 2
// 心拍がこの時間止まったら、同期ループでブラウザが固まっているとみなす
export const STALL_MS = 5000
export const HEARTBEAT_INTERVAL_MS = 500
export const READY_TIMEOUT_MS = 3000

export type WatchdogMessage = { type: 'start'; sab: SharedArrayBuffer } | { type: 'stop' }
// Worker からメインスレッドへ。監視を開始したことを知らせる
export type WatchdogReply = { type: 'ready' }
