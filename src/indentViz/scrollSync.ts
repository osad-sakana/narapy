/**
 * 昇順に並んだブロックの開始行から、エディタ上端の行 top を含むブロックの位置を二分探索で返す。
 * 「line <= top の最後のブロック」を選ぶので、長い複数行の文の途中が上端でも次の文へ飛ばない。
 * top より前にブロックがなければ先頭、空なら -1。
 */
export function findBlockIndex(lines: readonly number[], top: number): number {
  if (lines.length === 0) return -1
  let low = 0
  let high = lines.length - 1
  let found = 0
  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid] <= top) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}
