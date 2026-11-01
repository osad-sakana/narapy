import type { StatementType } from './parse'

// 意味（文の種類）で色分けする。Scratch のブロックと同じく塗りつぶしで描くので、
// ライト／ダーク共通の色にする。実際の塗りは fillOf() で白に寄せた薄い色
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

/** ブロック見出しのラベル。other は付けない。import は語そのものが見出しなのでアイコンだけにする */
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

/** ブロック上の文字色。塗りは常に薄い色なので、白文字は使わず濃色に固定する */
export const INK_COLOR = '#1b1b29'

/** 塗りは文の種類の色を白に寄せる。この割合が「元の色」の比率（残りが白） */
const FILL_COLOR_RATIO = 0.55

function channel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG のコントラスト比（1〜21） */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 文の種類の色を白に寄せた、実際に表示するブロックの塗りの色 */
export function fillOf(color: string): string {
  const n = Number.parseInt(color.slice(1), 16)
  const mix = (shift: number): string =>
    Math.round(((n >> shift) & 255) * FILL_COLOR_RATIO + 255 * (1 - FILL_COLOR_RATIO)).toString(16).padStart(2, '0')
  return `#${mix(16)}${mix(8)}${mix(0)}`
}
