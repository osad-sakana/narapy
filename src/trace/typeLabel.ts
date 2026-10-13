// ステップ実行の変数一覧に出す型名。学習者向けに、基本の型だけ日本語表記を添える。
const BASIC_TYPE_JA: Readonly<Record<string, string>> = {
  int: '整数',
  float: '小数',
  str: '文字列',
  bool: '真偽値',
  list: 'リスト',
  tuple: 'タプル',
  dict: '辞書',
  set: '集合',
  NoneType: 'なし',
}

export function typeLabel(type: string): string {
  const ja = Object.hasOwn(BASIC_TYPE_JA, type) ? BASIC_TYPE_JA[type] : undefined
  return ja ? `${type}（${ja}）` : type
}
