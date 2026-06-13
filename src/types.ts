export type WorkerMessage =
  | { type: 'stdout' | 'error' | 'loading'; payload: string }
  | { type: 'result'; payload: string | null }
  | { type: 'image'; payload: string; title: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }
  | { type: 'interrupt_sab'; sab: SharedArrayBuffer }

export interface RunPayload {
  type: 'run'
  code: string
  files: Record<string, string>
}
