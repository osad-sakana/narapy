export interface LogicalLine {
  /** タブを4スペースに換算した先頭インデント幅 */
  readonly indent: number
  /** コメント除去済みの文。複数行にまたがる場合は改行で結合する */
  readonly text: string
  /** 文が始まる物理行（1始まり） */
  readonly line: number
}

const TAB_WIDTH = 4

// 文字列リテラル1つだけの文（docstring を含む）。可視化の対象外
// 三連引用符は途中に終端を含まない形にして、"""a""" + """b""" を1つの文字列と誤認しない
const STRING_ONLY = /^[rRuUbBfF]{0,2}(?:"""(?:(?!""")[\s\S])*"""|'''(?:(?!''')[\s\S])*'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/

interface ScanState {
  readonly depth: number
  /** 三連引用符の中にいるとき、その引用符（""" か '''） */
  readonly triple: string | null
}

interface ScanResult {
  readonly state: ScanState
  /** コメントを除いた行の内容 */
  readonly code: string
  /** 行末がバックスラッシュ継続か */
  readonly continued: boolean
}

function scanLine(line: string, initial: ScanState): ScanResult {
  let { depth, triple } = initial
  let quote: string | null = null
  let code = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (triple) {
      if (ch === '\\' && i + 1 < line.length) {
        code += ch + line[++i]
      } else if (line.startsWith(triple, i)) {
        code += triple
        i += 2
        triple = null
      } else {
        code += ch
      }
      continue
    }
    if (quote) {
      code += ch
      if (ch === '\\' && i + 1 < line.length) {
        code += line[++i]
      } else if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === '#') break
    if (ch === '"' || ch === "'") {
      const tri = ch.repeat(3)
      if (line.startsWith(tri, i)) {
        triple = tri
        code += tri
        i += 2
        continue
      }
      quote = ch
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1)
    }
    code += ch
  }
  // 閉じていない単一引用符は行末で打ち切る（構文エラー時に後続行を巻き込まないため）
  const continued = triple === null && quote === null && code.trimEnd().endsWith('\\')
  return { state: { depth, triple }, code, continued }
}

function leadingWidth(line: string): number {
  let width = 0
  for (const ch of line) {
    if (ch === ' ') width += 1
    else if (ch === '\t') width += TAB_WIDTH
    else break
  }
  return width
}

interface Part {
  readonly indent: number
  readonly text: string
}

// parts は同じ文を読む間だけ push で伸ばす局所の配列（スプレッドでの再生成は行数の2乗になる）
interface Pending {
  readonly indent: number
  readonly line: number
  readonly parts: Part[]
}

interface Accumulator {
  pending: Pending | null
  state: ScanState
}

// 継続行は文の先頭行からの相対インデントを 4→2 スペースに詰めて残す（表示用）
function joinParts(parts: readonly Part[]): string {
  const base = parts[0]?.indent ?? 0
  return parts
    .map((part, i) => (i === 0 ? part.text : ' '.repeat(Math.max(0, part.indent - base) / 2) + part.text))
    .join('\n')
}

function flushPending(acc: Accumulator, result: LogicalLine[]): void {
  const { pending } = acc
  acc.pending = null
  acc.state = { depth: 0, triple: null }
  if (!pending || pending.parts.length === 0) return
  const text = joinParts(pending.parts)
  if (!STRING_ONLY.test(text)) {
    result.push({ indent: pending.indent, text, line: pending.line })
  }
}

// 入力途中で閉じ括弧が無いとき、以降すべてが1文に飲まれて構造が見えなくなるのを防ぐ。
// 括弧の中でも、文の開始位置以下のインデントで始まる「…:」終わりのブロック見出しが来たら
// そこで前の文を打ち切る（正しいコードの括弧内にこの形の行は現れない）
// match / case はソフトキーワード（辞書キー等にも使える）なので、後ろに式が続く形（match x: / match(x):）だけを見出しとみなす
const BLOCK_HEADER = /^(?:async\s+)?(?:(?:if|elif|else|for|while|def|class|try|except|finally|with)(?![\p{L}\p{N}_])|(?:match|case)\s*[^\s:=,)\]}]).*:\s*(?:#.*)?$/u

function abandonsUnclosedBracket(acc: Accumulator, raw: string): boolean {
  const { pending, state } = acc
  if (!pending || state.depth === 0 || state.triple) return false
  return leadingWidth(raw) <= pending.indent && BLOCK_HEADER.test(raw.trim())
}

/**
 * ソースを論理行（1文）の列に分解する。括弧・三連引用符・バックスラッシュで
 * 複数物理行にまたがる文は1つにまとめ、コメントと docstring は捨てる。
 */
export function splitLogicalLines(source: string): LogicalLine[] {
  const result: LogicalLine[] = []
  const acc: Accumulator = { pending: null, state: { depth: 0, triple: null } }

  for (const [index, raw] of source.split(/\r\n|\r|\n/).entries()) {
    if (abandonsUnclosedBracket(acc, raw)) flushPending(acc, result)
    if (acc.pending === null && raw.trim() === '') continue
    const scanned = scanLine(raw, acc.state)
    const pending = acc.pending ?? { indent: leadingWidth(raw), line: index + 1, parts: [] }
    const piece = scanned.continued ? scanned.code.trimEnd().slice(0, -1) : scanned.code
    if (piece.trim()) pending.parts.push({ indent: leadingWidth(piece), text: piece.trim() })
    acc.pending = pending
    acc.state = scanned.state
    if (acc.state.depth === 0 && !acc.state.triple && !scanned.continued) flushPending(acc, result)
  }

  // 閉じられないまま終わった文も落とさない
  flushPending(acc, result)
  return result
}
