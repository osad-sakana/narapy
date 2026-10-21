// import 文だけを対象にする（コメント・文字列中の "import pygame" を誤検出しないよう行頭から判定）
const PYGAME_IMPORT = /^[ \t]*(?:from[ \t]+pygame(?:\.\w+)*[ \t]+import\b|import[ \t]+[^#\n]*\bpygame\b)/m

export function usesPygame(code: string): boolean {
  return PYGAME_IMPORT.test(code)
}
