import { splitLogicalLines, type LogicalLine } from './logicalLines'

export type StatementType =
  | 'if' | 'elif' | 'else' | 'for' | 'while'
  | 'def' | 'method' | 'class'
  | 'try' | 'except' | 'finally'
  | 'with' | 'match' | 'case'
  | 'assignment' | 'import' | 'other'

export interface VizNode {
  readonly type: StatementType
  /** def / class に付いたデコレータ（@ 付きの行） */
  readonly decorators: readonly string[]
  /** 文の本体。複数行の文は改行で結合されている */
  readonly text: string
  /** 先頭行の行番号（1始まり） */
  readonly line: number
  readonly children: readonly VizNode[]
}

const HARD_COMPOUND = /^(?:async\s+)?(def|class|if|elif|else|for|while|try|except|finally|with)\b/
const SOFT_COMPOUND = /^(match|case)\b/
const IMPORT = /^(?:import\s|from\s+\S+\s+import\b)/

// 左辺に括弧を許さないことで foo(a=1) のキーワード引数を代入から除く
const ASSIGNMENT = /^[\w.[\],\s*'"-]+(?:\/\/|\*\*|>>|<<|[-+*/%@&|^])?=(?!=)/
const ANNOTATION = /^[A-Za-z_][\w.]*\s*:\s*[^=\s]/

function firstLine(text: string): string {
  return text.split('\n', 1)[0]
}

function compoundType(text: string): StatementType | null {
  const hard = HARD_COMPOUND.exec(text)
  if (hard) return hard[1] as StatementType
  const soft = SOFT_COMPOUND.exec(text)
  if (soft && text.endsWith(':')) return soft[1] as StatementType
  return null
}

function simpleType(text: string): StatementType {
  if (IMPORT.test(text)) return 'import'
  const head = firstLine(text)
  if (ASSIGNMENT.test(head) || (!head.startsWith('lambda') && ANNOTATION.test(head))) return 'assignment'
  return 'other'
}

/** import 文で使えるようになる名前を返す（as があれば別名）。import 以外の文は空配列 */
export function parseImportNames(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim()
  const body = /^import\s+(.*)$/.exec(flat)?.[1] ?? /^from\s+\S+\s+import\s+(.*)$/.exec(flat)?.[1]
  if (body === undefined) return []
  return body
    .replace(/[()]/g, ' ')
    .split(',')
    .map(part => part.trim().split(/\s+as\s+/).pop() ?? '')
    .filter(name => name !== '')
}

interface ParseContext {
  readonly lines: readonly LogicalLine[]
  /** 次に読む論理行の位置。parseScope が進める */
  pos: number
}

// def / class 以外の前に置かれたデコレータ、またはスコープ末尾に残ったものは消さずに単純文として出す
function strayDecorators(decorators: readonly LogicalLine[]): VizNode[] {
  return decorators.map(d => ({ type: 'other', decorators: [], text: d.text, line: d.line, children: [] }))
}

function parseScope(ctx: ParseContext, parentIndent: number, insideClass: boolean): VizNode[] {
  const nodes: VizNode[] = []
  let decorators: LogicalLine[] = []

  while (ctx.pos < ctx.lines.length && ctx.lines[ctx.pos].indent > parentIndent) {
    const line = ctx.lines[ctx.pos++]
    if (line.text.startsWith('@')) {
      decorators.push(line)
      continue
    }
    const compound = compoundType(line.text)
    const base = compound ?? simpleType(line.text)
    const type = base === 'def' && insideClass ? 'method' : base
    const keepsDecorators = base === 'def' || base === 'class'
    if (!keepsDecorators) nodes.push(...strayDecorators(decorators))
    const children = compound ? parseScope(ctx, line.indent, insideClass || compound === 'class') : []
    nodes.push({
      type,
      decorators: keepsDecorators ? decorators.map(d => d.text) : [],
      text: line.text,
      line: line.line,
      children,
    })
    decorators = []
  }
  nodes.push(...strayDecorators(decorators))
  return nodes
}

/** ソースをインデントに沿った文の木にする。単純文も1文ごとに1ノード */
export function parseIndentTree(source: string): VizNode[] {
  return parseScope({ lines: splitLogicalLines(source), pos: 0 }, -1, false)
}
