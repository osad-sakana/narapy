import type { TraceResult, TraceStep, TraceVar } from './types'

export type ParseTraceResult =
  | { ok: true; result: TraceResult }
  | { ok: false; error: string }

function isTraceVar(value: unknown): value is TraceVar {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.name === 'string' && typeof v.type === 'string' && typeof v.value === 'string'
}

function isTraceVarArray(value: unknown): value is TraceVar[] {
  return Array.isArray(value) && value.every(isTraceVar)
}

function isTraceStep(value: unknown): value is TraceStep {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.line !== 'number') return false
  if (v.event !== 'line' && v.event !== 'return' && v.event !== 'exception') return false
  if (typeof v.funcName !== 'string') return false
  if (typeof v.depth !== 'number') return false
  if (!isTraceVarArray(v.locals)) return false
  if (v.globals !== null && !isTraceVarArray(v.globals)) return false
  if (typeof v.stdout !== 'string') return false
  return true
}

// Pyodide Worker から届く未信頼の文字列を、型安全な TraceResult へ変換する。
// 想定外の形式は例外を投げず {ok:false} として返し、呼び出し側で
// トレースパネルを表示しない（=無効化する）判断に使えるようにする。
export function parseTraceResult(json: string): ParseTraceResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'トレース結果のJSON解析に失敗しました' }
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'トレース結果の形式が不正です' }
  }
  const r = raw as Record<string, unknown>

  if (!Array.isArray(r.steps) || !r.steps.every(isTraceStep)) {
    return { ok: false, error: 'トレース結果のステップ形式が不正です' }
  }
  if (typeof r.truncated !== 'boolean') {
    return { ok: false, error: 'トレース結果のtruncatedフィールドが不正です' }
  }
  if (r.error !== null && typeof r.error !== 'string') {
    return { ok: false, error: 'トレース結果のerrorフィールドが不正です' }
  }
  if (typeof r.trailingStdout !== 'string') {
    return { ok: false, error: 'トレース結果のtrailingStdoutフィールドが不正です' }
  }

  return {
    ok: true,
    result: {
      steps: r.steps as TraceStep[],
      truncated: r.truncated,
      error: (r.error as string | null) ?? null,
      trailingStdout: r.trailingStdout,
    },
  }
}
