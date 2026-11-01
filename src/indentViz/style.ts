import type { StatementType } from './parse'

// 意味（文の種類）で色分けする。Scratch のブロックと同じく塗りつぶしで描くので、
// ライト／ダーク共通の色にし、文字色は塗りごとにコントラストの高い方を選ぶ（TYPE_INK）
export const TYPE_COLORS: Readonly<Record<StatementType, string>> = {
  if: '#ffb84d', elif: '#ffb84d', else: '#ffb84d',
  for: '#ffab19', while: '#ffab19',
  def: '#5cb1d6',
  method: '#4cbfe6',
  class: '#cf63cf',
  try: '#ff6680', except: '#ff6680', finally: '#ff6680',
  with: '#59c059',
  match: '#d65cd6', case: '#d65cd6',
  assignment: '#ff8c1a',
  import: '#59c059',
  other: '#9966ff',
}

/** ブロック見出しのラベル。other は付けない */
export const TYPE_LABELS: Readonly<Partial<Record<StatementType, string>>> = {
  if: 'もし',
  elif: 'でなくてもし',
  else: 'でなければ',
  for: 'くり返し(for)',
  while: 'くり返し(while)',
  def: '関数',
  method: 'メソッド',
  class: 'クラス',
  try: '例外処理',
  except: '捕捉',
  finally: '最終処理',
  with: 'with',
  match: 'マッチ',
  case: 'マッチ',
  assignment: '代入',
  import: 'import',
}

/** ブロック見出しに添える FontAwesome のアイコン名 */
export const TYPE_ICONS: Readonly<Partial<Record<StatementType, string>>> = {
  if: 'code-branch',
  elif: 'code-branch',
  else: 'code-branch',
  for: 'repeat',
  while: 'rotate',
  def: 'cube',
  method: 'gear',
  class: 'building',
  try: 'shield-halved',
  except: 'triangle-exclamation',
  finally: 'circle-check',
  with: 'clipboard-list',
  match: 'crosshairs',
  case: 'crosshairs',
  assignment: 'download',
  import: 'cube',
}

const INK_DARK = '#1b1b29'
const INK_LIGHT = '#ffffff'

function channel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 塗りの色の上に載せる文字色。白と濃色のうちコントラスト比が高い方 */
export function inkOn(fill: string): string {
  return contrast(fill, INK_LIGHT) >= contrast(fill, INK_DARK) ? INK_LIGHT : INK_DARK
}

export const TYPE_INK: Readonly<Record<StatementType, string>> = Object.fromEntries(
  Object.entries(TYPE_COLORS).map(([type, fill]) => [type, inkOn(fill)]),
) as Record<StatementType, string>
