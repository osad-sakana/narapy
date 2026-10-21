import type { RunFile } from '../types'
import { collectImportedSources } from './importGraph'

// import 文だけを対象にする（コメント・文字列中の "import pygame" を誤検出しないよう行頭から判定）。
// 共有リンクで開いた任意の .py にも毎回かかるため、`[ \t]+` と `[^#\n]*` のように同じ文字を取り合う
// 量指定子の並びは避ける（長い 1 行で二次時間のバックトラックになる）
const PYGAME_IMPORT = /^[ \t]*(?:from[ \t]+pygame(?:\.\w+)*[ \t]+import\b|import[ \t][^#\n]*\bpygame\b)/m

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
//
// pygame を使うかは、実行するコードだけでなく、そこから import されるプロジェクト内の .py も見る
// （main.py は `import game` だけで、game.py が `import pygame` する構成を Worker に回さないため）。
export function routeRun(
  mode: RunMode,
  code: string,
  testCode = '',
  files: readonly RunFile[] = [],
): RunRoute {
  const roots = mode === 'grade' ? [code, testCode] : [code]
  const usesIt = [...roots, ...collectImportedSources(roots, files)].some(usesPygame)
  if (mode === 'normal') {
    return usesIt ? { kind: 'pygame' } : { kind: 'worker' }
  }
  return usesIt ? { kind: 'unsupported', message: UNSUPPORTED_MESSAGES[mode] } : { kind: 'worker' }
}
