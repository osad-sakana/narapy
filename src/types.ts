export type WorkerMessage =
  | { type: 'stdout' | 'result' | 'error'; payload: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }

export interface RunPayload {
  type: 'run'
  code: string
  files: Record<string, string>
}
