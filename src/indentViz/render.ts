import type { VizBlock, VizGroup, VizKind, VizNode, VizStatement } from './parse'

// 意味（文の種類）で色分けする。テーマ間で共通の色を使い、背景は透過の薄い塗りにして
// ライト／ダークどちらの面でも読めるようにする
const KIND_COLORS: Readonly<Record<VizKind, string>> = {
  flow: '#f1944f',
  def: '#4c9be8',
  method: '#6ed0f0',
  class: '#e56fb0',
  try: '#ed5350',
  with: '#45b164',
  import: '#45b164',
  purple: '#b28fef',
  plain: '#8c8d94',
}

export const KIND_LEGEND: readonly { kind: VizKind; label: string }[] = [
  { kind: 'flow', label: 'if / for / while・代入' },
  { kind: 'def', label: 'def・return' },
  { kind: 'method', label: 'メソッド' },
  { kind: 'class', label: 'class・match' },
  { kind: 'try', label: 'try / except' },
  { kind: 'with', label: 'with・import' },
  { kind: 'purple', label: 'pass / raise / assert' },
]

export function kindColor(kind: VizKind): string {
  return KIND_COLORS[kind]
}

function tinted(el: HTMLElement, kind: VizKind, percent: number): void {
  const color = KIND_COLORS[kind]
  el.style.borderLeft = `4px solid ${color}`
  el.style.backgroundColor = `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

function renderStatement(statement: VizStatement): HTMLElement {
  const row = document.createElement('div')
  row.className = 'flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono text-xs text-ink'
  tinted(row, statement.kind, 14)

  const code = document.createElement('span')
  code.className = 'whitespace-pre-wrap break-all'
  code.textContent = statement.text
  row.appendChild(code)

  for (const name of statement.badges) {
    const badge = document.createElement('span')
    badge.className = 'px-1.5 rounded-full text-[10px] font-bold'
    badge.style.backgroundColor = KIND_COLORS.import
    badge.style.color = '#0d1117'
    badge.textContent = name
    row.appendChild(badge)
  }
  return row
}

function renderGroup(group: VizGroup): HTMLElement {
  const el = document.createElement('div')
  el.className = 'flex flex-col gap-px'
  for (const statement of group.statements) el.appendChild(renderStatement(statement))
  return el
}

function renderBlock(block: VizBlock): HTMLElement {
  const el = document.createElement('div')
  el.className = 'rounded-sm overflow-hidden'
  tinted(el, block.kind, 8)

  const head = document.createElement('div')
  head.className = 'px-2 py-0.5 font-mono text-xs font-bold text-ink whitespace-pre-wrap break-all'
  head.style.backgroundColor = `color-mix(in srgb, ${KIND_COLORS[block.kind]} 22%, transparent)`
  head.textContent = [...block.decorators, block.header].join('\n')
  el.appendChild(head)

  if (block.children.length > 0) {
    const body = document.createElement('div')
    body.className = 'flex flex-col gap-1 p-1 pl-3'
    for (const child of block.children) body.appendChild(renderNode(child))
    el.appendChild(body)
  }
  return el
}

export function renderNode(node: VizNode): HTMLElement {
  return node.type === 'group' ? renderGroup(node) : renderBlock(node)
}

/** ブロックの木を DOM にする。文字列はすべて textContent で入れる */
export function renderTree(nodes: readonly VizNode[]): HTMLElement {
  const root = document.createElement('div')
  root.className = 'flex flex-col gap-1'
  for (const node of nodes) root.appendChild(renderNode(node))
  return root
}
