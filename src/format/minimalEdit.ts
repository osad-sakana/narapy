export interface MinimalEdit {
  readonly start: number
  readonly end: number
  readonly text: string
}

// 全文置換だとカーソル・スクロール位置が飛ぶため、前後の共通部分を除いた差分だけを返す。
// start/end は before 上のオフセット。差分が無ければ null。
export function computeMinimalEdit(before: string, after: string): MinimalEdit | null {
  if (before === after) return null

  const max = Math.min(before.length, after.length)
  let prefix = 0
  while (prefix < max && before[prefix] === after[prefix]) prefix++

  // 接尾辞が接頭辞と重ならないよう、残り長さで頭打ちにする
  let suffix = 0
  while (
    suffix < max - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix++

  return {
    start: prefix,
    end: before.length - suffix,
    text: after.slice(prefix, after.length - suffix),
  }
}
