export interface LogicalLine {
  /** タブを4スペースに換算した先頭インデント幅 */
  readonly indent: number
  /** コメント除去・複数行結合済みの文。結合部は空白1つ */
  readonly text: string
  /** 文が始まる物理行（1始まり） */
  readonly line: number
  /** 直前に空行があったか（コメント行は空行にも文にも数えない） */
  readonly blankBefore: boolean
}

const TAB_WIDTH = 4

// 文字列リテラル1つだけの文（docstring を含む）。可視化の対象外
const STRING_ONLY = /^[rRuUbBfF]{0,2}(?:"""[\s\S]*"""|'''[\s\S]*'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/

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
      if (line.startsWith(triple, i)) {
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

interface Pending {
  readonly indent: number
  readonly line: number
  readonly blankBefore: boolean
  readonly parts: readonly string[]
}

function appendPart(pending: Pending, code: string, continued: boolean): Pending {
  const piece = continued ? code.trimEnd().slice(0, -1) : code
  const trimmed = piece.trim()
  return { ...pending, parts: trimmed ? [...pending.parts, trimmed] : pending.parts }
}

/**
 * ソースを論理行（1文）の列に分解する。括弧・三連引用符・バックスラッシュで
 * 複数物理行にまたがる文は1つにまとめ、コメントと docstring は捨てる。
 */
export function splitLogicalLines(source: string): LogicalLine[] {
  const result: LogicalLine[] = []
  let state: ScanState = { depth: 0, triple: null }
  let pending: Pending | null = null
  let blankBefore = false

  source.split(/\r\n|\r|\n/).forEach((raw, index) => {
    if (pending === null && raw.trim() === '') {
      blankBefore = true
      return
    }
    const scanned = scanLine(raw, state)
    pending = appendPart(
      pending ?? { indent: leadingWidth(raw), line: index + 1, blankBefore, parts: [] },
      scanned.code,
      scanned.continued,
    )
    state = scanned.state
    if (state.depth > 0 || state.triple || scanned.continued) return

    const text = pending.parts.join(' ')
    if (text !== '') {
      if (!STRING_ONLY.test(text)) {
        result.push({ indent: pending.indent, text, line: pending.line, blankBefore: pending.blankBefore })
      }
      blankBefore = false
    }
    pending = null
  })

  // 閉じられないまま終わった文も落とさない
  const tail = pending as Pending | null
  if (tail && tail.parts.length > 0 && !STRING_ONLY.test(tail.parts.join(' '))) {
    result.push({ indent: tail.indent, text: tail.parts.join(' '), line: tail.line, blankBefore: tail.blankBefore })
  }
  return result
}
