// input() の1回分の入力データに使える最大バイト数（UTF-8）。
// pyodide.worker.ts の INPUT_SAB のデータ領域サイズと src/runner/index.ts の
// 入力上限チェックの両方から参照し、二重管理を避ける。
export const MAX_INPUT_BYTES = 4092

export type WorkerMessage =
  | { type: 'stdout' | 'error' | 'loading'; payload: string }
  | { type: 'result'; payload: string | null }
  | { type: 'image'; payload: string; title: string }
  | { type: 'turtle'; payload: string }
  | { type: 'trace'; payload: string }
  | { type: 'grade'; payload: string }
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
  background?: string | null
}

export type RunFile =
  | { kind: 'text'; path: string; data: string }
  | { kind: 'binary'; path: string; data: Uint8Array }

export interface RunPayload {
  type: 'run'
  code: string
  files: RunFile[]
  directories: string[]
  // 省略時は 'normal'。'trace' は sys.settrace によるステップ実行トレース
  // （src/pyodide/traceRun.ts）で、top-level await を含むコードは実行できない。
  // 'grade' は演習の自動採点（src/pyodide/gradeRun.ts）で、testCode必須。
  mode?: 'normal' | 'trace' | 'grade'
  // mode: 'grade' のときの test.py の内容
  testCode?: string
}

// 演習採点1件分の結果（src/pyodide/gradeModule.ts の run_tests() が返すJSONの要素）
export interface GradeCase {
  name: string
  passed: boolean
  message: string | null
}

export interface GradeResult {
  cases: GradeCase[]
  // test_関数の抽出失敗・構文エラーなど、個別ケースに紐付かない全体エラー
  error: string | null
}
