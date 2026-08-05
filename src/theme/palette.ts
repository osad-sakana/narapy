// Narapy のカラーパレット（単一の真実）。
//
// Tailwind のユーティリティ（bg-panel など）は src/style.css の @theme ブロックが生成するが、
// Monaco と Blockly のテーマ定義は CSS 変数を解釈できず hex を直接要求するため、
// 同じ値を TS 側にも持つ必要がある。CSS から TS を import することはできないので
// この 1 箇所だけ重複が避けられない。palette.test.ts が両者の一致を検査している。
//
// キー名は CSS カスタムプロパティ名と対応する（canvas → --color-canvas,
// codeKeyword → --color-code-keyword）。
export const PALETTE = {
  /** アプリ全体の背景 */
  canvas: '#1b1c1f',
  /** ヘッダー・サイドバーなど一段持ち上げた面 */
  panel: '#212226',
  /** 境界線 */
  line: '#33343a',
  /** 本文 */
  ink: '#e6e6ea',
  /** 補助テキスト・非アクティブ */
  muted: '#8c8d94',
  /** ホバー時の背景 */
  hover: '#2c2d33',
  /** 単一アクセント（実行ボタン・アクティブ表示） */
  accent: '#00b5ce',
  /** アクセント上に載せる文字色 */
  accentInk: '#0d1117',
  /** エラー */
  danger: '#ed5350',
  /** 成功 */
  success: '#45b164',
  /** 警告 */
  warn: '#f1944f',
  /** コードエディタの背景 */
  editor: '#191a1d',
  /** コードの既定文字色 */
  code: '#d7d8dd',
  codeKeyword: '#b28fef',
  codeString: '#6dba70',
  codeNumber: '#f1944f',
  codeComment: '#6b6c73',
  codeBuiltin: '#00bad1',
  codeFunc: '#d8b349',
} as const

export type PaletteKey = keyof typeof PALETTE

/** Monaco / Blockly は先頭の `#` を含まない hex を要求する箇所があるため */
export function bareHex(key: PaletteKey): string {
  return PALETTE[key].slice(1)
}

/** camelCase のキーを CSS カスタムプロパティ名へ変換する（codeKeyword → --color-code-keyword） */
export function toCssVarName(key: string): string {
  return `--color-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}
