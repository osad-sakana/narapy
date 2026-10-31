import type { StatementType } from './parse'

// 意味（文の種類）で色分けする。ライト／ダーク共通の色にし、背景は透過の薄い塗りにして
// どちらのテーマの面でも読めるようにする
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

/** ブロック見出しのアイコン付きラベル。other は付けない */
export const TYPE_LABELS: Readonly<Partial<Record<StatementType, string>>> = {
  if: '🔀 もし',
  elif: '🔀 でなくてもし',
  else: '🔀 でなければ',
  for: '🔁 くり返し(for)',
  while: '🔄 くり返し(while)',
  def: '📦 関数',
  method: '⚙️ メソッド',
  class: '🏗️ クラス',
  try: '🛡️ 例外処理',
  except: '⚠️ 捕捉',
  finally: '✅ 最終処理',
  with: '📋 with',
  match: '🎯 マッチ',
  case: '🎯 マッチ',
  assignment: '📥 代入',
  import: '📦',
}
