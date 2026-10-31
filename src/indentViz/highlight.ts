import { parseImportNames, type StatementType } from './parse'

export type SegmentClass = 'plain' | 'keyword' | 'var' | 'arrow' | 'badge' | 'loopvar'

export interface Segment {
  readonly text: string
  readonly cls: SegmentClass
  /** 色を決める文の種類（TYPE_COLORS のキー）。plain では使わない */
  readonly tone: StatementType
}

const plain = (text: string): Segment => ({ text, cls: 'plain', tone: 'other' })
const seg = (text: string, cls: SegmentClass, tone: StatementType): Segment => ({ text, cls, tone })

// 文頭キーワードの色。return/yield は関数、break/continue はループ、それ以外は other の色にする
const OTHER_KEYWORD_TONES: Readonly<Record<string, StatementType>> = {
  return: 'def', yield: 'def',
  break: 'for', continue: 'for',
  pass: 'other', raise: 'other', assert: 'other',
}

const COMPOUND_KEYWORD = /^(\s*)((?:async\s+)?(?:def|class|if|elif|else|for|while|try|except|finally|with|match|case))(?![\p{L}\p{N}_])(.*)$/u
const FOR_LOOP = /^(\s*)(async\s+)?(for)\s+([\p{L}_][\p{L}\p{N}_,\s]*?)\s+(in)\s+(.*)$/u
const ASSIGN = /^([\p{L}_][\p{L}\p{N}_,\s[\].]*?)\s*=\s*(?!=)(.*)$/u

function highlightFor(line: string): Segment[] | null {
  const m = FOR_LOOP.exec(line)
  if (!m) return null
  const [, space, asyncKw, kw, variable, inKw, rest] = m
  return [
    plain(space),
    ...(asyncKw ? [seg(asyncKw, 'keyword', 'for')] : []),
    seg(kw, 'keyword', 'for'), plain(' '),
    seg(variable, 'loopvar', 'assignment'), plain(' '),
    seg(inKw, 'keyword', 'for'), plain(' ' + rest),
  ]
}

function highlightCompound(line: string, type: StatementType): Segment[] {
  const m = COMPOUND_KEYWORD.exec(line)
  if (!m) return [plain(line)]
  return [plain(m[1]), seg(m[2], 'keyword', type), plain(m[3])]
}

function highlightAssignment(lines: readonly string[]): Segment[][] {
  const m = ASSIGN.exec(lines[0])
  if (!m) return lines.map(l => [plain(l)])
  const head = [seg(m[1], 'var', 'assignment'), plain(' '), seg('=', 'arrow', 'other'), plain(' ' + m[2])]
  return [head, ...lines.slice(1).map(l => [plain(l)])]
}

function highlightOther(line: string): Segment[] {
  const m = /^(\s*)([\p{L}_][\p{L}\p{N}_]*)(.*)$/u.exec(line)
  const tone = m ? OTHER_KEYWORD_TONES[m[2]] : undefined
  return m && tone ? [plain(m[1]), seg(m[2], 'keyword', tone), plain(m[3])] : [plain(line)]
}

function highlightImport(text: string): Segment[] {
  const flat = text.replace(/\s+/g, ' ').trim()
  const badges = parseImportNames(flat).flatMap(name => [seg(name, 'badge', 'import'), plain(' ')])
  const from = /^from\s+(\S+)\s+import\b/.exec(flat)
  const head = from
    ? [seg('from', 'keyword', 'other'), plain(` ${from[1]} `), seg('import', 'keyword', 'other'), plain(' ')]
    : [seg('import', 'keyword', 'other'), plain(' ')]
  return [...head, ...badges.slice(0, -1)]
}

/**
 * 文を行ごとの装飾セグメントにする。HTML は作らず、文字列はそのまま返すので、
 * 呼び出し側が textContent で入れればエスケープ漏れは起きない。
 */
export function highlightStatement(text: string, type: StatementType): Segment[][] {
  if (type === 'import') return [highlightImport(text)]
  const lines = text.split('\n')
  if (type === 'assignment') return highlightAssignment(lines)
  const [head, ...rest] = lines
  const first = type === 'other'
    ? highlightOther(head)
    : (type === 'for' ? highlightFor(head) : null) ?? highlightCompound(head, type)
  return [first, ...rest.map(l => [plain(l)])]
}

/** デコレータ行。関数の色で表示する */
export function highlightDecorator(line: string): Segment[] {
  return [seg(line, 'keyword', 'def')]
}
