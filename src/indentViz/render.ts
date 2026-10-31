import { highlightDecorator, highlightStatement, type Segment, type SegmentClass } from './highlight'
import type { VizNode } from './parse'
import { TYPE_COLORS, TYPE_LABELS } from './style'

const SEGMENT_CLASSES: Readonly<Record<SegmentClass, string>> = {
  plain: '',
  keyword: 'font-bold',
  var: 'font-bold',
  arrow: 'font-bold',
  badge: 'inline-block px-1.5 rounded text-[0.9em] font-bold',
  loopvar: 'inline-block px-1.5 rounded text-[0.9em] font-semibold',
}

function renderSegment(segment: Segment): Node {
  if (segment.cls === 'plain') return document.createTextNode(segment.text)
  const el = document.createElement('span')
  el.className = SEGMENT_CLASSES[segment.cls]
  el.textContent = segment.text
  const color = TYPE_COLORS[segment.tone]
  if (segment.cls === 'badge' || segment.cls === 'loopvar') {
    el.style.backgroundColor = color
    el.style.color = '#0d1117'
  } else {
    el.style.color = color
  }
  return el
}

function renderCode(lines: readonly (readonly Segment[])[]): HTMLElement {
  const code = document.createElement('div')
  code.className = 'flex-1 min-w-0 font-mono text-xs text-ink whitespace-pre-wrap break-words'
  lines.forEach((segments, i) => {
    if (i > 0) code.appendChild(document.createTextNode('\n'))
    for (const segment of segments) code.appendChild(renderSegment(segment))
  })
  return code
}

function renderLabel(node: VizNode): HTMLElement | null {
  const label = TYPE_LABELS[node.type]
  if (!label) return null
  const pill = document.createElement('span')
  pill.className = 'shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap'
  pill.style.backgroundColor = TYPE_COLORS[node.type]
  pill.style.color = '#0d1117'
  pill.textContent = label
  return pill
}

export function renderNode(node: VizNode): HTMLElement {
  const color = TYPE_COLORS[node.type]
  const block = document.createElement('div')
  block.className = 'rounded-md'
  block.dataset.line = String(node.line)
  block.dataset.statement = node.type
  block.style.borderLeft = `4px solid ${color}`
  block.style.backgroundColor = `color-mix(in srgb, ${color} 9%, transparent)`

  const header = document.createElement('div')
  header.className = 'flex items-start gap-2 px-2 py-1'
  const label = renderLabel(node)
  if (label) header.appendChild(label)
  header.appendChild(renderCode([
    ...node.decorators.map(highlightDecorator).map(s => [...s]),
    ...highlightStatement(node.text, node.type),
  ]))
  block.appendChild(header)

  if (node.children.length > 0) {
    const body = document.createElement('div')
    body.className = 'flex flex-col gap-1 pb-1 pl-3 pr-1'
    for (const child of node.children) body.appendChild(renderNode(child))
    block.appendChild(body)
  }
  return block
}

/** 文の木を DOM にする。文字列はすべて textContent / テキストノードで入れる */
export function renderTree(nodes: readonly VizNode[]): HTMLElement {
  const root = document.createElement('div')
  root.className = 'flex flex-col gap-1'
  for (const node of nodes) root.appendChild(renderNode(node))
  return root
}
