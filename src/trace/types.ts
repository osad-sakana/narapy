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
  // 直前のステップからこのステップを記録するまでの間に書き込まれた標準出力の差分。
  // 空文字列の場合が多い（print()を含む行の次のステップで初めて非空になる）。
  stdout: string
}

export interface TraceResult {
  steps: TraceStep[]
  truncated: boolean
  error: string | null
  // ステップ上限による打ち切り後、全速実行中に書き込まれた標準出力（どのステップにも
  // 紐付かない）。truncated が false のときは常に空文字列。
  trailingStdout: string
}
