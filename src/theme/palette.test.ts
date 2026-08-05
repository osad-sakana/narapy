import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PALETTE, toCssVarName } from './palette'

// vitest は CSS の import を握りつぶすため（test.css 既定 false）、?raw ではなく fs で直接読む
const styleCss = readFileSync(fileURLToPath(new URL('../style.css', import.meta.url)), 'utf-8')

// palette.ts（Monaco / Blockly が参照）と style.css の @theme（Tailwind ユーティリティを生成）は
// 同じ色を二重に定義している。CSS から TS を import できないため避けられない重複なので、
// 片方だけ書き換えて配色がちぐはぐになる事故をここで防ぐ。
// index.html とヘッダークラス定数の整合性テスト（layout/index.test.ts）と同じ流儀。
describe('palette.ts と style.css の @theme トークン', () => {
  function parseThemeColors(css: string): Record<string, string> {
    const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1]
    if (!block) throw new Error('style.css に @theme ブロックが見つかりません')
    const result: Record<string, string> = {}
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*(--color-[a-z0-9-]+)\s*:\s*([^;]+);/)
      if (m) result[m[1]] = m[2].trim()
    }
    return result
  }

  const themeColors = parseThemeColors(styleCss)

  it('palette.ts の全キーが @theme に同じ値で存在する', () => {
    for (const [key, hex] of Object.entries(PALETTE)) {
      expect(themeColors[toCssVarName(key)], `${toCssVarName(key)} が @theme にない、または値が異なる`)
        .toBe(hex)
    }
  })

  it('@theme に palette.ts 側で未定義の --color-* が残っていない', () => {
    const expected = new Set(Object.keys(PALETTE).map(toCssVarName))
    expect(Object.keys(themeColors).filter((name) => !expected.has(name))).toEqual([])
  })

  it('全トークンが小文字6桁の hex である（Monaco / Blockly が oklch を解釈できないため）', () => {
    for (const [key, hex] of Object.entries(PALETTE)) {
      expect(hex, key).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
