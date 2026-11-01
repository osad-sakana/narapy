import type { StatementType, VizNode } from './parse'

/** 子を持ちうる複合文。これらは C 字型ブロックで描く */
const COMPOUND_TYPES: ReadonlySet<StatementType> = new Set<StatementType>([
  'if', 'elif', 'else', 'for', 'while', 'def', 'method', 'class',
  'try', 'except', 'finally', 'with', 'match', 'case',
])

export function isCompound(type: StatementType): boolean {
  return COMPOUND_TYPES.has(type)
}

// 先頭の文と直前の節の種類から、次の節を同じブロックに続けてよいかを決める。
// Scratch の「もし〜でなければ」のように、1つのブロックが口を複数持つ形で描くための判定
function continuesChain(head: StatementType, last: StatementType, next: StatementType): boolean {
  switch (head) {
    case 'if':
      return (next === 'elif' || next === 'else') && (last === 'if' || last === 'elif')
    case 'try':
      if (next === 'except') return last === 'try' || last === 'except'
      if (next === 'else') return last === 'except'
      return next === 'finally' && (last === 'try' || last === 'except' || last === 'else')
    case 'for':
    case 'while':
      return next === 'else' && last === head
    default:
      return false
  }
}

/**
 * 兄弟の文を、1つのブロックとして描く単位にまとめる。
 * if/elif/else、try/except/else/finally、for・while の else は先頭の文に続く節になり、
 * それ以外は1文ずつの単位になる。対応する先頭がない elif / else 等も単独の単位として残す。
 */
export function groupChains(nodes: readonly VizNode[]): VizNode[][] {
  const groups: VizNode[][] = []
  for (const node of nodes) {
    const current = groups[groups.length - 1]
    if (current && continuesChain(current[0].type, current[current.length - 1].type, node.type)) {
      current.push(node)
    } else {
      groups.push([node])
    }
  }
  return groups
}
