export type WorkerMessage =
  | { type: 'stdout' | 'error' | 'loading'; payload: string }
  | { type: 'result'; payload: string | null }
  | { type: 'image'; payload: string; title: string }
  | { type: 'turtle'; payload: string }
  | { type: 'input_sab'; sab: SharedArrayBuffer }
  | { type: 'input_request'; prompt: string }
  | { type: 'interrupt_sab'; sab: SharedArrayBuffer }

// turtle 互換モジュール（src/pyodide/turtleModule.ts）が出力する描画データ。
// 座標は turtle 座標系（中央原点・Y軸上向き・0度=東）。
export interface TurtleSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
}

export interface TurtleCommands {
  segments: TurtleSegment[]
  turtle: { x: number; y: number; heading: number; visible: boolean }
}

export type RunFile =
  | { kind: 'text'; path: string; data: string }
  | { kind: 'binary'; path: string; data: Uint8Array }

export interface RunPayload {
  type: 'run'
  code: string
  files: RunFile[]
  directories: string[]
}
