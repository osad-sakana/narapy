// import 文だけを対象にする（コメント・文字列中の "import pygame" を誤検出しないよう行頭から判定）
const PYGAME_IMPORT = /^[ \t]*(?:from[ \t]+pygame(?:\.\w+)*[ \t]+import\b|import[ \t]+[^#\n]*\bpygame\b)/m

export function usesPygame(code: string): boolean {
  return PYGAME_IMPORT.test(code)
}

export type RunMode = 'normal' | 'trace' | 'grade'

export type RunRoute =
  | { kind: 'worker' }
  | { kind: 'pygame' }
  | { kind: 'unsupported'; message: string }

const UNSUPPORTED_MESSAGES: Record<Exclude<RunMode, 'normal'>, string> = {
  trace:
    'pygame を使うコードはステップ実行に対応していません。通常の実行（▶ 実行）を使ってください。',
  grade:
    'pygame を使うコードは自動採点に対応していません（採点は画面を持たない環境で実行されるため）。',
}

// 実行モードとコードから、実行経路を決める。
// pygame は SDL が canvas を必要とするため、画面を持たない Worker（ステップ実行・採点）では
// 動かせない（set_mode で異常終了する）。通常実行だけメインスレッドのモーダルで動かす。
export function routeRun(mode: RunMode, code: string, testCode = ''): RunRoute {
  if (mode === 'normal') {
    return usesPygame(code) ? { kind: 'pygame' } : { kind: 'worker' }
  }
  const usesIt = usesPygame(code) || (mode === 'grade' && usesPygame(testCode))
  return usesIt ? { kind: 'unsupported', message: UNSUPPORTED_MESSAGES[mode] } : { kind: 'worker' }
}
