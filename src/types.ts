export type WorkerMessage =
  | { type: 'stdout' | 'error' | 'loading'; payload: string }
  | { type: 'result'; payload: string | null }
  | { type: 'image'; payload: string; title: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }
  | { type: 'interrupt_sab'; sab: SharedArrayBuffer }

export type RunFile =
  | { kind: 'text'; path: string; data: string }
  | { kind: 'binary'; path: string; data: Uint8Array }

export interface RunPayload {
  type: 'run'
  code: string
  files: RunFile[]
  directories: string[]
}
