import type { MenuAction } from '../menu/ui'
import { parseIndentTree } from './parse'
import { KIND_LEGEND, kindColor, renderTree } from './render'

export interface IndentVizSource {
  /** 今開いているファイルの名前 */
  getFileName: () => string
  /** 今開いているファイルの現在の内容 */
  getContent: () => string
}

function createLegend(): HTMLElement {
  const legend = document.createElement('div')
  legend.className = 'flex flex-wrap gap-x-3 gap-y-1 px-5 py-2 border-b border-line text-[11px] text-muted shrink-0'
  for (const { kind, label } of KIND_LEGEND) {
    const item = document.createElement('span')
    item.className = 'flex items-center gap-1'
    const swatch = document.createElement('span')
    swatch.className = 'inline-block w-2.5 h-2.5 rounded-sm'
    swatch.style.backgroundColor = kindColor(kind)
    item.append(swatch, label)
    legend.appendChild(item)
  }
  return legend
}

function createBody(content: string): HTMLElement {
  const body = document.createElement('div')
  body.className = 'overflow-y-auto p-5'
  const tree = parseIndentTree(content)
  if (tree.length === 0) {
    body.className += ' text-xs text-muted'
    body.textContent = '表示できるコードがありません。'
    return body
  }
  body.appendChild(renderTree(tree))
  return body
}

export function showIndentVizModal(source: IndentVizSource): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden'
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')
  card.setAttribute('aria-label', 'インデント可視化')

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-5 py-3 border-b border-line shrink-0'
  const title = document.createElement('span')
  title.className = 'text-sm font-bold text-ink truncate'
  title.textContent = `インデント可視化 — ${source.getFileName()}`
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'text-muted hover:text-ink transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-hover cursor-pointer shrink-0'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')
  header.append(title, closeBtn)

  card.append(header, createLegend(), createBody(source.getContent()))
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const close = (): void => {
    backdrop.remove()
    document.removeEventListener('keydown', handleKey)
  }
  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }
  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', handleKey)
  closeBtn.focus()
}

export function createIndentVizMenuAction(source: IndentVizSource): MenuAction {
  return { label: 'インデント可視化', onClick: () => showIndentVizModal(source) }
}
