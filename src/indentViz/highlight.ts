import { parseImportNames, type StatementType } from './parse'

/**
 * keyword: ブロックの語（if / for / = など）。input: Scratch の入力欄にあたる白い楕円
 * （条件・式・変数名・import 名）。plain: それ以外の文字
 */
export type SegmentClass = 'plain' | 'keyword' | 'input'

export interface Segment {
  readonly text: string
  readonly cls: SegmentClass
}

const plain = (text: string): Segment => ({ text, cls: 'plain' })
const keyword = (text: string): Segment => ({ text, cls: 'keyword' })
const input = (text: string): Segment => ({ text, cls: 'input' })

const SIMPLE_KEYWORDS: ReadonlySet<string> = new Set(['return', 'yield', 'break', 'continue', 'pass', 'raise', 'assert'])

// 識別子は日本語などの非ASCIIも使えるので、\w / \b ではなく Unicode の文字クラスで判定する
const COMPOUND_KEYWORD = /^\s*((?:async\s+)?(?:def|class|if|elif|else|for|while|try|except|finally|with|match|case))(?![\p{L}\p{N}_])([\s\S]*)$/u
const FOR_LOOP = /^\s*(async\s+)?for\s+([\p{L}_][\p{L}\p{N}_,\s]*?)\s+in\s+([\s\S]*)$/u
const ASSIGN = /^([\p{L}_][\p{L}\p{N}_,\s[\].]*?)\s*=\s*(?!=)([\s\S]*)$/u

/** Scratch のブロックに「:」は無いので、見出しの末尾のコロンは表示しない */
function stripColon(text: string): string {
  return text.trim().replace(/:$/, '').trim()
}

function withInput(head: Segment[], value: string): Segment[] {
  return value ? [...head, plain(' '), input(value)] : head
}

function highlightFor(text: string): Segment[] | null {
  const m = FOR_LOOP.exec(text)
  if (!m) return null
  const [, asyncKw, variable, iterable] = m
  const head = [keyword(asyncKw ? 'async for' : 'for'), plain(' '), input(variable.trim()), plain(' '), keyword('in')]
  return withInput(head, stripColon(iterable))
}

function highlightCompound(text: string): Segment[] {
  const m = COMPOUND_KEYWORD.exec(text)
  if (!m) return [plain(text)]
  return withInput([keyword(m[1])], stripColon(m[2]))
}

function highlightAssignment(text: string): Segment[] {
  const m = ASSIGN.exec(text)
  if (!m) return [plain(text)]
  return [input(m[1].trim()), plain(' '), keyword('='), plain(' '), input(m[2].trim())]
}

function highlightSimpleLine(line: string): Segment[] {
  const m = /^(\s*)([\p{L}_][\p{L}\p{N}_]*)([\s\S]*)$/u.exec(line)
  return m && SIMPLE_KEYWORDS.has(m[2]) ? [plain(m[1]), keyword(m[2]), plain(m[3])] : [plain(line)]
}

function highlightImport(text: string): Segment[] {
  const flat = text.replace(/\s+/g, ' ').trim()
  const names = parseImportNames(flat).flatMap(name => [input(name), plain(' ')]).slice(0, -1)
  const from = /^from\s+(\S+)\s+import(?![\p{L}\p{N}_])/u.exec(flat)
  const head = from
    ? [keyword('from'), plain(` ${from[1]} `), keyword('import'), plain(' ')]
    : [keyword('import'), plain(' ')]
  return [...head, ...names]
}

/**
 * 文を行ごとの装飾セグメントにする。HTML は作らず、文字列はそのまま返すので、
 * 呼び出し側が textContent で入れればエスケープ漏れは起きない。
 * 複合文・代入・import は入力欄を含む1行にまとめ、複数行の式は入力欄の中で改行を保つ。
 */
export function highlightStatement(text: string, type: StatementType): Segment[][] {
  switch (type) {
    case 'import':
      return [highlightImport(text)]
    case 'assignment':
      return [highlightAssignment(text)]
    case 'other': {
      const [head, ...rest] = text.split('\n')
      return [highlightSimpleLine(head), ...rest.map(l => [plain(l)])]
    }
    default:
      return [(type === 'for' ? highlightFor(text) : null) ?? highlightCompound(text)]
  }
}

/** デコレータ行 */
export function highlightDecorator(line: string): Segment[] {
  return [keyword(line)]
}
