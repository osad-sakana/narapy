import { splitLogicalLines, type LogicalLine } from './logicalLines'

/** 色の分類。具体色は render 側で決める */
export type VizKind = 'flow' | 'def' | 'method' | 'class' | 'try' | 'with' | 'import' | 'purple' | 'plain'

export interface VizStatement {
  readonly text: string
  readonly kind: VizKind
  /** import 文で取り込まれる名前（as があれば別名） */
  readonly badges: readonly string[]
  readonly line: number
}

export interface VizGroup {
  readonly type: 'group'
  readonly statements: readonly VizStatement[]
}

export interface VizBlock {
  readonly type: 'block'
  readonly kind: VizKind
  readonly decorators: readonly string[]
  readonly header: string
  readonly children: readonly VizNode[]
  readonly line: number
}

export type VizNode = VizGroup | VizBlock

const HARD_COMPOUND = /^(?:async\s+)?(def|class|if|elif|else|for|while|try|except|finally|with)\b/
const SOFT_COMPOUND = /^(match|case)\b/

const COMPOUND_KINDS: Readonly<Record<string, VizKind>> = {
  def: 'def', class: 'class', match: 'class', case: 'class',
  if: 'flow', elif: 'flow', else: 'flow', for: 'flow', while: 'flow',
  try: 'try', except: 'try', finally: 'try', with: 'with',
}

const SIMPLE_KEYWORD_KINDS: Readonly<Record<string, VizKind>> = {
  import: 'import', from: 'import',
  return: 'def', yield: 'def',
  break: 'flow', continue: 'flow',
  pass: 'purple', raise: 'purple', assert: 'purple',
}

// 左辺に括弧を許さないことで foo(a=1) のキーワード引数を代入から除く
const ASSIGNMENT = /^[\w.[\],\s*'"-]+?\s*(?:\/\/|\*\*|>>|<<|[-+*/%@&|^])?=(?!=)/
const ANNOTATION = /^[A-Za-z_][\w.]*\s*:\s*[^=\s]/

function firstWord(text: string): string {
  return /^[A-Za-z_]\w*/.exec(text)?.[0] ?? ''
}

function compoundKind(text: string): { kind: VizKind } | null {
  const hard = HARD_COMPOUND.exec(text)
  if (hard) return { kind: COMPOUND_KINDS[hard[1]] }
  const soft = SOFT_COMPOUND.exec(text)
  if (soft && text.endsWith(':')) return { kind: COMPOUND_KINDS[soft[1]] }
  return null
}

function simpleKind(text: string): VizKind {
  const word = firstWord(text)
  const byKeyword = SIMPLE_KEYWORD_KINDS[word]
  if (byKeyword) return byKeyword
  if (ASSIGNMENT.test(text) || (word !== 'lambda' && ANNOTATION.test(text))) return 'flow'
  return 'plain'
}

/** import 文で使えるようになる名前を返す。import 以外の文は空配列 */
export function parseImportNames(text: string): string[] {
  const body = /^import\s+(.*)$/.exec(text)?.[1] ?? /^from\s+\S+\s+import\s+(.*)$/.exec(text)?.[1]
  if (body === undefined) return []
  return body
    .replace(/[()]/g, ' ')
    .split(',')
    .map(part => part.trim().split(/\s+as\s+/).pop() ?? '')
    .filter(name => name !== '')
}

function toStatement(line: LogicalLine): VizStatement {
  const kind = simpleKind(line.text)
  return { text: line.text, kind, badges: kind === 'import' ? parseImportNames(line.text) : [], line: line.line }
}

/** 単純文を、空行・ブロックで区切れるまで1グループにまとめる */
function groupStatements(items: readonly (VizNode | { statement: VizStatement; blankBefore: boolean })[]): VizNode[] {
  const nodes: VizNode[] = []
  let current: VizStatement[] = []
  const flush = (): void => {
    if (current.length > 0) nodes.push({ type: 'group', statements: current })
    current = []
  }
  for (const item of items) {
    if ('type' in item) {
      flush()
      nodes.push(item)
      continue
    }
    if (item.blankBefore) flush()
    current = [...current, item.statement]
  }
  flush()
  return nodes
}

interface ParseContext {
  readonly lines: readonly LogicalLine[]
  /** 次に読む論理行の位置。parseScope が進める */
  pos: number
}

function parseScope(ctx: ParseContext, parentIndent: number, parentKind: VizKind | null): VizNode[] {
  const items: (VizNode | { statement: VizStatement; blankBefore: boolean })[] = []
  let decorators: string[] = []

  while (ctx.pos < ctx.lines.length && ctx.lines[ctx.pos].indent > parentIndent) {
    const line = ctx.lines[ctx.pos++]
    if (line.text.startsWith('@')) {
      decorators = [...decorators, line.text]
      continue
    }
    const compound = compoundKind(line.text)
    if (!compound) {
      items.push({ statement: toStatement(line), blankBefore: line.blankBefore })
      decorators = []
      continue
    }
    const kind = compound.kind === 'def' && parentKind === 'class' ? 'method' : compound.kind
    items.push({
      type: 'block',
      kind,
      decorators,
      header: line.text,
      children: parseScope(ctx, line.indent, kind),
      line: line.line,
    })
    decorators = []
  }
  return groupStatements(items)
}

/** ソースをインデントに沿ったブロックの木にする */
export function parseIndentTree(source: string): VizNode[] {
  const ctx: ParseContext = { lines: splitLogicalLines(source), pos: 0 }
  return parseScope(ctx, -1, null)
}
