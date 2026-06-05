export type WorkerMessage =
  | { type: 'stdout' | 'result' | 'error' | 'loading'; payload: string }
  | { type: 'image'; payload: string; title: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }

export interface RunPayload {
  type: 'run'
  code: string
  files: Record<string, string>
}
