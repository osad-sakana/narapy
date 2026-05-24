export interface WorkerMessage {
  type: 'result' | 'error' | 'stdout'
  payload: string
}
