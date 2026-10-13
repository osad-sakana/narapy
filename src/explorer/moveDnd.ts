import type { MoveSource } from './move'

const ENTRY_MIME = 'application/x-narapy-entry'
const DROP_HIGHLIGHT = ['bg-accent/20', 'ring-1', 'ring-inset', 'ring-accent']

// dragover 中は dataTransfer の中身を読めないため、ドラッグ中の項目はモジュール内に持つ。
// ファイルのアップロード用ドラッグ（'Files'）とは区別するため、内部ドラッグ中だけ非 null になる。
let dragging: MoveSource | null = null

export function endDrag(): void {
  dragging = null
}

// ツリー内の項目を移動元としてドラッグ可能にする
export function makeDraggable(el: HTMLElement, source: MoveSource): void {
  el.draggable = true
  el.addEventListener('dragstart', (e) => {
    dragging = source
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      // Firefox は setData しないとドラッグが始まらない
      e.dataTransfer.setData(ENTRY_MIME, source.path)
    }
  })
  el.addEventListener('dragend', endDrag)
}

// 内部ドラッグ中、移動先にならない要素（ファイル行など）の上で、親（ルート）が
// 移動先として反応してしまうのを防ぐ
export function blockInternalDrop(el: HTMLElement): void {
  el.addEventListener('dragover', (e) => {
    if (dragging) e.stopPropagation()
  })
  el.addEventListener('drop', (e) => {
    if (dragging) e.stopPropagation()
  })
}

export interface DropTargetOptions {
  destDir: string
  canDrop: (source: MoveSource, destDir: string) => boolean
  onDrop: (source: MoveSource, destDir: string) => void
}

// 移動先（フォルダ行・ルート）にする。移動できない組み合わせでは drop を受け付けない
// （カーソルが禁止表示になる）。
export function makeDropTarget(el: HTMLElement, { destDir, canDrop, onDrop }: DropTargetOptions): void {
  const setHighlight = (on: boolean): void => {
    for (const cls of DROP_HIGHLIGHT) el.classList.toggle(cls, on)
  }

  el.addEventListener('dragover', (e) => {
    if (!dragging) return
    e.stopPropagation()
    if (!canDrop(dragging, destDir)) {
      setHighlight(false)
      return
    }
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    setHighlight(true)
  })

  el.addEventListener('dragleave', (e) => {
    if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return
    setHighlight(false)
  })

  el.addEventListener('drop', (e) => {
    if (!dragging) return
    e.stopPropagation()
    e.preventDefault()
    setHighlight(false)
    const source = dragging
    // 移動に成功すると再描画で元の要素が消え dragend が届かないため、ここで終わらせる
    endDrag()
    if (canDrop(source, destDir)) onDrop(source, destDir)
  })
}
