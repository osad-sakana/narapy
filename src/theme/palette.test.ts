import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DARK_PALETTE, LIGHT_PALETTE, toCssVarName, type Palette } from './palette'

// vitest は CSS の import を握りつぶすため（test.css 既定 false）、?raw ではなく fs で直接読む
const styleCss = readFileSync(fileURLToPath(new URL('../style.css', import.meta.url)), 'utf-8')

function parseColorVars(block: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(--color-[a-z0-9-]+)\s*:\s*([^;]+);/)
    if (m) result[m[1]] = m[2].trim()
  }
  return result
}

function extractBlock(selector: string): string {
  // ネストしていないトップレベルのブロックのみを対象にする（`\n}` で閉じる想定）
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = styleCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1]
  if (block === undefined) throw new Error(`style.css に ${selector} ブロックが見つかりません`)
  return block
}

// palette.ts（Monaco / Blockly が参照）と style.css のトークン定義（Tailwind ユーティリティを生成）は
// 同じ色を二重に定義している。CSS から TS を import できないため避けられない重複なので、
// 片方だけ書き換えて配色がちぐはぐになる事故をここで防ぐ。
// index.html とヘッダークラス定数の整合性テスト（layout/index.test.ts）と同じ流儀。
describe('palette.ts と style.css のカラートークン', () => {
  const cases: ReadonlyArray<[string, Palette, string]> = [
    ['ダーク（@theme の既定値）', DARK_PALETTE, '@theme'],
    ['ライト（明示選択）', LIGHT_PALETTE, ":root[data-theme='light']"],
    ['ライト（システム追従）', LIGHT_PALETTE, ':root:not([data-theme])'],
  ]

  for (const [label, palette, selector] of cases) {
    describe(label, () => {
      const cssVars = parseColorVars(extractBlock(selector))

      it('palette.ts の全キーが同じ値で存在する', () => {
        for (const [key, hex] of Object.entries(palette)) {
          expect(cssVars[toCssVarName(key)], `${toCssVarName(key)} が ${selector} にない、または値が異なる`)
            .toBe(hex)
        }
      })

      it('palette.ts 側で未定義の --color-* が残っていない', () => {
        const expected = new Set(Object.keys(palette).map(toCssVarName))
        expect(Object.keys(cssVars).filter((name) => !expected.has(name))).toEqual([])
      })
    })
  }

  it('全トークンが小文字6桁の hex である（Monaco / Blockly が oklch を解釈できないため）', () => {
    for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
      for (const [key, hex] of Object.entries(palette)) {
        expect(hex, key).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('ダークとライトで全キーの値が異なる（片方のコピー漏れを防ぐ）', () => {
    for (const key of Object.keys(DARK_PALETTE) as Array<keyof Palette>) {
      expect(LIGHT_PALETTE[key], key).not.toBe(DARK_PALETTE[key])
    }
  })
})
