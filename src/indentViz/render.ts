import { setIconLabel } from '../ui/icon'
import { groupChains, isCompound } from './chains'
import { highlightDecorator, highlightStatement, type Segment } from './highlight'
import type { VizNode } from './parse'
import { TYPE_COLORS, TYPE_ICONS, TYPE_INK, TYPE_LABELS } from './style'

// 見た目（形・切り欠き・白い入力欄）は style.css の .viz-* が担当する。
// ここでは要素の構造と、塗りの色・文字色（--viz-color / --viz-ink）の指定だけを行う。
// テストや同期処理が見る hook は data-* 属性（data-line / data-statement / data-role）。

function setRole(el: HTMLElement, role: string): HTMLElement {
  el.dataset.role = role
  return el
}

function paint(el: HTMLElement, node: VizNode): void {
  el.style.setProperty('--viz-color', TYPE_COLORS[node.type])
  el.style.setProperty('--viz-ink', TYPE_INK[node.type])
}

function markSource(el: HTMLElement, node: VizNode): void {
  el.dataset.line = String(node.line)
  el.dataset.statement = node.type
}

function renderSegment(segment: Segment): Node {
  if (segment.cls === 'plain') return document.createTextNode(segment.text)
  const el = document.createElement('span')
  el.textContent = segment.text
  if (segment.cls === 'input') {
    el.className = 'viz-input'
    el.dataset.role = 'input'
    // 改行を含む式は、楕円ではなく角の丸い箱にする
    if (segment.text.includes('\n')) el.classList.add('viz-input-multiline')
  } else {
    el.className = 'viz-keyword'
  }
  return el
}

function renderCode(lines: readonly (readonly Segment[])[]): HTMLElement {
  const code = setRole(document.createElement('div'), 'code')
  code.className = 'viz-code'
  lines.forEach((segments, i) => {
    if (i > 0) code.appendChild(document.createTextNode('\n'))
    for (const segment of segments) code.appendChild(renderSegment(segment))
  })
  return code
}

function renderLabel(node: VizNode): HTMLElement | null {
  const label = TYPE_LABELS[node.type]
  if (!label) return null
  const pill = setRole(document.createElement('span'), 'label')
  pill.className = 'viz-label'
  const icon = TYPE_ICONS[node.type]
  if (icon) setIconLabel(pill, icon, label)
  else pill.textContent = label
  return pill
}

/** ブロックの見出し行（ラベル + コード）。複合文の見出し腕と、単純文のブロックで共通 */
function fillHeader(el: HTMLElement, node: VizNode): void {
  const label = renderLabel(node)
  if (label) el.appendChild(label)
  el.appendChild(renderCode([
    ...node.decorators.map(highlightDecorator),
    ...highlightStatement(node.text, node.type),
  ]))
}

/** 代入・import・その他の単純文。子を持たない積み木 */
function renderStatementBlock(node: VizNode): HTMLElement {
  const block = document.createElement('div')
  block.className = 'viz-block'
  markSource(block, node)
  paint(block, node)
  fillHeader(block, node)
  return block
}

/**
 * 複合文（とそれに続く節）を C 字型の1つのブロックにする。
 * 見出し腕 → 口（子の積み木）を節の数だけ繰り返し、最後に下の腕で閉じる。
 * 色は先頭の文のものを全体に使う（for の else なども同じ色で続く）。
 */
function renderCBlock(clauses: readonly VizNode[]): HTMLElement {
  const block = document.createElement('div')
  block.className = 'viz-c'
  paint(block, clauses[0])
  for (const clause of clauses) {
    const head = document.createElement('div')
    head.className = 'viz-c-head'
    markSource(head, clause)
    fillHeader(head, clause)
    const mouth = setRole(document.createElement('div'), 'mouth')
    mouth.className = 'viz-c-mouth'
    mouth.appendChild(renderStack(clause.children))
    block.append(head, mouth)
  }
  const foot = document.createElement('div')
  foot.className = 'viz-c-foot'
  block.appendChild(foot)
  return block
}

function renderStack(nodes: readonly VizNode[]): HTMLElement {
  const stack = document.createElement('div')
  stack.className = 'viz-stack'
  for (const group of groupChains(nodes)) {
    stack.appendChild(isCompound(group[0].type) ? renderCBlock(group) : renderStatementBlock(group[0]))
  }
  return stack
}

/**
 * 文の木を Scratch 風のブロックの DOM にする。文字列はすべて textContent / テキストノードで入れる。
 * 一番上にもハットブロックは付けず、積み木と C 字型ブロックの入れ子だけで包含関係を示す。
 */
export function renderTree(nodes: readonly VizNode[]): HTMLElement {
  return renderStack(nodes)
}
