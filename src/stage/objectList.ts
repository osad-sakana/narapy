// ゲームオブジェクト一覧パネルの描画と操作。
// 状態は持たず、呼び出し側から渡された配列を描画し、操作はコールバックで通知する。

import type { GameObject } from './types'

export interface ObjectListCallbacks {
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

const ITEM_BASE =
  'group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm transition-colors'
const ITEM_ACTIVE = 'bg-violet-500/20 text-violet-100 border border-violet-500/40'
const ITEM_IDLE = 'text-slate-300 hover:bg-slate-700/40 border border-transparent'

function buildItem(
  obj: GameObject,
  activeId: string | null,
  callbacks: ObjectListCallbacks,
): HTMLElement {
  const item = document.createElement('div')
  item.className = `${ITEM_BASE} ${obj.id === activeId ? ITEM_ACTIVE : ITEM_IDLE}`
  item.addEventListener('click', () => callbacks.onSelect(obj.id))

  const dot = document.createElement('span')
  dot.className = 'w-2 h-2 rounded-full bg-violet-400 shrink-0'

  const label = document.createElement('span')
  label.textContent = obj.name
  label.className = 'flex-1 truncate'

  const del = document.createElement('button')
  del.textContent = '✕'
  del.title = '削除'
  del.className =
    'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity shrink-0'
  del.addEventListener('click', (e) => {
    e.stopPropagation()
    callbacks.onDelete(obj.id)
  })

  item.append(dot, label, del)
  return item
}

function buildAddButton(callbacks: ObjectListCallbacks): HTMLElement {
  const btn = document.createElement('button')
  btn.textContent = '＋ オブジェクトを追加'
  btn.className =
    'w-full mt-1 px-3 py-1.5 rounded-md text-xs text-violet-300 border border-dashed border-violet-700/60 hover:bg-violet-500/10 transition-colors cursor-pointer'
  btn.addEventListener('click', () => callbacks.onAdd())
  return btn
}

// 一覧を container へ再描画する（毎回まるごと作り直す）。
export function renderObjectList(
  container: HTMLElement,
  objects: readonly GameObject[],
  activeId: string | null,
  callbacks: ObjectListCallbacks,
): void {
  container.replaceChildren()
  for (const obj of objects) {
    container.appendChild(buildItem(obj, activeId, callbacks))
  }
  container.appendChild(buildAddButton(callbacks))
}
