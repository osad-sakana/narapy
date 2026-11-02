import { buildMessage, type MissingCallWarning } from './result'

export interface LintMarker {
  readonly severity: number
  readonly message: string
  readonly startLineNumber: number
  readonly startColumn: number
  readonly endLineNumber: number
  readonly endColumn: number
}

// monaco を import しない純粋関数にするため、severity（MarkerSeverity.Warning）は呼び出し側から受け取る
export function toMarkers(warnings: readonly MissingCallWarning[], severity: number): LintMarker[] {
  return warnings.map(w => ({
    severity,
    message: buildMessage(w),
    startLineNumber: w.line,
    startColumn: w.col,
    endLineNumber: w.line,
    endColumn: w.endCol,
  }))
}
