// 講師モードの差分エンジン。エディタ実装に依存しない純粋関数。

export interface AddedLine {
  kind: 'added'
  /** current側の1始まり行番号 */
  line: number
}

export interface DeletedAtLine {
  kind: 'deletedAt'
  /** この行番号の直前（current側1始まり）で削除が起きた。EOFでの削除は行数+1になりうる */
  line: number
}

export interface ModifiedLine {
  kind: 'modified'
  /** current側の1始まり行番号 */
  line: number
  baselineText: string
  currentText: string
}

export type LineChange = AddedLine | DeletedAtLine | ModifiedLine

export interface InlineRangeChange {
  kind: 'range'
  /** current行内でのUTF-16列（1始まり、開始位置） */
  start: number
  /** current行内でのUTF-16列（1始まり、終了位置・排他） */
  end: number
}

export interface InlineDeletionMarker {
  kind: 'deletionMarker'
  /** current行内でのUTF-16列（1始まり）。挿入を伴わない削除の位置を示す幅ゼロのマーカー */
  column: number
}

export type InlineChange = InlineRangeChange | InlineDeletionMarker

// 行diffの安全弁: 行数×行数のDPテーブルがこれを超える場合は空配列（ハイライトなし）を返す
const MAX_CELLS = 4_000_000
// 文字diffの安全弁: 文字数×文字数がこれを超える場合は行全体を1つの変更範囲にフォールバックする
const MAX_INLINE_CELLS = 200_000

type EditOp<T> =
  | { kind: 'equal' }
  | { kind: 'del'; value: T }
  | { kind: 'ins'; value: T }

// 実際の編集は局所的なことがほとんどなので、LCSにかける前に共通の先頭・末尾を除いておく。
// これによりDPテーブルのサイズ（延いてはMAX_CELLS/MAX_INLINE_CELLSへの抵触しやすさ）を
// 実際に変化した範囲だけに縮小できる。
function trimCommonEnds<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): { prefix: number; suffix: number } {
  const minLen = Math.min(a.length, b.length)
  let prefix = 0
  while (prefix < minLen && eq(a[prefix], b[prefix])) prefix++
  let suffix = 0
  while (suffix < minLen - prefix && eq(a[a.length - 1 - suffix], b[b.length - 1 - suffix])) suffix++
  return { prefix, suffix }
}

// LCS（最長共通部分列）に基づく編集操作列を求める。n*m が maxCells を超える場合は null。
function computeEditOps<T>(a: T[], b: T[], maxCells: number, eq: (x: T, y: T) => boolean): EditOp<T>[] | null {
  const n = a.length
  const m = b.length
  if (n * m > maxCells) return null

  // dp[i][j] = a[i..n) と b[j..m) のLCS長
  const dp: Int32Array[] = new Array(n + 1)
  for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1)
  for (let i = n - 1; i >= 0; i--) {
    const dpi = dp[i]
    const dpi1 = dp[i + 1]
    for (let j = m - 1; j >= 0; j--) {
      dpi[j] = eq(a[i], b[j]) ? dpi1[j + 1] + 1 : Math.max(dpi1[j], dpi[j + 1])
    }
  }

  const ops: EditOp<T>[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      ops.push({ kind: 'equal' })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'del', value: a[i] })
      i++
    } else {
      ops.push({ kind: 'ins', value: b[j] })
      j++
    }
  }
  while (i < n) {
    ops.push({ kind: 'del', value: a[i] })
    i++
  }
  while (j < m) {
    ops.push({ kind: 'ins', value: b[j] })
    j++
  }
  return ops
}

// equal以外が連続する1ブロック（idx以降、次のequalの手前まで）を処理し、
// 「削除の直後に追加」を先頭からインデックス順に1件のmodifiedへまとめる。
// 削除・追加の数が異なる場合、超過分はそれぞれ deletedAt / added として個別に扱う。
function processBlock(
  ops: EditOp<string>[],
  startIdx: number,
  startLine: number,
): { changes: LineChange[]; nextIdx: number; nextLine: number } {
  const blockDeletes: string[] = []
  const blockInserts: { text: string; line: number }[] = []
  let idx = startIdx
  let curLine = startLine
  while (idx < ops.length && ops[idx].kind !== 'equal') {
    const o = ops[idx]
    if (o.kind === 'del') {
      blockDeletes.push(o.value)
    } else if (o.kind === 'ins') {
      blockInserts.push({ text: o.value, line: curLine })
      curLine++
    }
    idx++
  }

  const changes: LineChange[] = []
  const pairCount = Math.min(blockDeletes.length, blockInserts.length)
  for (let k = 0; k < pairCount; k++) {
    changes.push({
      kind: 'modified',
      line: blockInserts[k].line,
      baselineText: blockDeletes[k],
      currentText: blockInserts[k].text,
    })
  }
  for (let k = pairCount; k < blockInserts.length; k++) {
    changes.push({ kind: 'added', line: blockInserts[k].line })
  }
  // ペアリングされなかった削除は、ブロック終了時点のcurLine（＝この後に続く現在行、
  // またはブロックがファイル末尾なら行数+1）の直前で起きたものとして1件にまとめる
  if (blockDeletes.length > pairCount) {
    changes.push({ kind: 'deletedAt', line: curLine })
  }
  return { changes, nextIdx: idx, nextLine: curLine }
}

// baseline → current の行単位diff。
export function diffLines(baseline: string, current: string): LineChange[] {
  const a = baseline.split('\n')
  const b = current.split('\n')
  const eq = (x: string, y: string) => x === y
  const { prefix, suffix } = trimCommonEnds(a, b, eq)
  const ops = computeEditOps(a.slice(prefix, a.length - suffix), b.slice(prefix, b.length - suffix), MAX_CELLS, eq)
  if (ops === null) return []

  const result: LineChange[] = []
  let curLine = prefix + 1
  let idx = 0
  while (idx < ops.length) {
    if (ops[idx].kind === 'equal') {
      curLine++
      idx++
      continue
    }
    const block = processBlock(ops, idx, curLine)
    result.push(...block.changes)
    idx = block.nextIdx
    curLine = block.nextLine
  }
  return result
}

// コードポイント単位で文字列を分解する（サロゲートペア対応）
function toCodepoints(line: string): string[] {
  return Array.from(line)
}

// 各コードポイントの開始位置に対応するUTF-16列（1始まり）を求める。
// 戻り値の長さは codepoints.length + 1 で、末尾は行末の列を表す。
function codepointColumns(codepoints: string[]): number[] {
  const cols: number[] = [1]
  let col = 1
  for (const cp of codepoints) {
    col += cp.length
    cols.push(col)
  }
  return cols
}

// baseline行 → current行 の文字単位diff（modified行に対してのみ実行する）。
export function diffInline(baselineLine: string, currentLine: string): InlineChange[] {
  const a = toCodepoints(baselineLine)
  const b = toCodepoints(currentLine)
  const eq = (x: string, y: string) => x === y
  const { prefix, suffix } = trimCommonEnds(a, b, eq)
  const ops = computeEditOps(a.slice(prefix, a.length - suffix), b.slice(prefix, b.length - suffix), MAX_INLINE_CELLS, eq)
  if (ops === null) {
    return currentLine.length === 0 ? [] : [{ kind: 'range', start: 1, end: currentLine.length + 1 }]
  }

  const bCols = codepointColumns(b)
  const result: InlineChange[] = []
  let bIndex = prefix
  let idx = 0
  while (idx < ops.length) {
    const op = ops[idx]
    if (op.kind === 'equal') {
      bIndex++
      idx++
      continue
    }

    const blockStartBIndex = bIndex
    let insertedCount = 0
    while (idx < ops.length && ops[idx].kind !== 'equal') {
      const o = ops[idx]
      if (o.kind === 'ins') {
        bIndex++
        insertedCount++
      }
      idx++
    }

    if (insertedCount === 0) {
      // 挿入を伴わない純粋な削除: 表示できる範囲を持たないため幅ゼロのマーカーを返す
      result.push({ kind: 'deletionMarker', column: bCols[blockStartBIndex] })
    } else {
      result.push({ kind: 'range', start: bCols[blockStartBIndex], end: bCols[bIndex] })
    }
  }
  return result
}
