// Narapy のカラーパレット（単一の真実）。
//
// Tailwind のユーティリティ（bg-panel など）は src/style.css の @theme と
// ライトモードの上書きブロックが生成するが、Monaco と Blockly のテーマ定義は
// CSS 変数を解釈できず hex を直接要求するため、同じ値を TS 側にも持つ必要がある。
// CSS から TS を import することはできないのでこの 1 箇所だけ重複が避けられない。
// palette.test.ts が両者の一致を検査している。
//
// キー名は CSS カスタムプロパティ名と対応する（canvas → --color-canvas,
// codeKeyword → --color-code-keyword）。
export interface Palette {
  /** アプリ全体の背景 */
  canvas: string
  /** ヘッダー・サイドバーなど一段持ち上げた面 */
  panel: string
  /** 境界線 */
  line: string
  /** 本文 */
  ink: string
  /** 補助テキスト・非アクティブ */
  muted: string
  /** ホバー時の背景 */
  hover: string
  /** 単一アクセント（実行ボタン・アクティブ表示） */
  accent: string
  /** アクセント上に載せる文字色 */
  accentInk: string
  /** エラー */
  danger: string
  /** 成功 */
  success: string
  /** 警告 */
  warn: string
  /** コードエディタの背景 */
  editor: string
  /** コードの既定文字色 */
  code: string
  codeKeyword: string
  codeString: string
  codeNumber: string
  codeComment: string
  codeBuiltin: string
  codeFunc: string
}

export const DARK_PALETTE: Palette = {
  canvas: '#1b1c1f',
  panel: '#212226',
  line: '#33343a',
  ink: '#e6e6ea',
  muted: '#8c8d94',
  hover: '#2c2d33',
  accent: '#00b5ce',
  accentInk: '#0d1117',
  danger: '#ed5350',
  success: '#45b164',
  warn: '#f1944f',
  editor: '#191a1d',
  code: '#d7d8dd',
  codeKeyword: '#b28fef',
  codeString: '#6dba70',
  codeNumber: '#f1944f',
  codeComment: '#6b6c73',
  codeBuiltin: '#00bad1',
  codeFunc: '#d8b349',
}

export const LIGHT_PALETTE: Palette = {
  canvas: '#f6f6f7',
  panel: '#ffffff',
  line: '#e3e3e6',
  ink: '#202124',
  muted: '#75767d',
  hover: '#eef0f2',
  accent: '#0086a1',
  accentInk: '#ffffff',
  danger: '#be222a',
  success: '#00722e',
  warn: '#9a3e00',
  editor: '#fbfbfc',
  code: '#2a2b2f',
  codeKeyword: '#6d41a9',
  codeString: '#045e17',
  codeNumber: '#9a3e00',
  codeComment: '#9a9ba1',
  codeBuiltin: '#006a83',
  codeFunc: '#734e00',
}

export type ResolvedTheme = 'light' | 'dark'

export const PALETTES: Record<ResolvedTheme, Palette> = {
  dark: DARK_PALETTE,
  light: LIGHT_PALETTE,
}

/** Monaco の rules.foreground は先頭 `#` を受け付けないため */
export function bareHex(palette: Palette, key: keyof Palette): string {
  return palette[key].slice(1)
}

/** camelCase のキーを CSS カスタムプロパティ名へ変換する（codeKeyword → --color-code-keyword） */
export function toCssVarName(key: string): string {
  return `--color-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}
