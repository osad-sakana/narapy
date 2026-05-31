export type WorkerMessage =
  | { type: 'stdout' | 'result' | 'error'; payload: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request' }
