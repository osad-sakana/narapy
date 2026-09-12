// src/pyodide/traceModule.ts が出力するJSONに対応する型。
export interface TraceVar {
  name: string
  type: string
  value: string
}

export type TraceEvent = 'line' | 'return' | 'exception'

export interface TraceStep {
  line: number
  event: TraceEvent
  funcName: string
  // 0 = モジュール直下、1以上 = 関数呼び出しのネスト段数
  depth: number
  locals: TraceVar[]
  // depth 0 では locals がそのまま globals と同一のため null（省略）になる
  globals: TraceVar[] | null
}

export interface TraceResult {
  steps: TraceStep[]
  truncated: boolean
  error: string | null
}
