import {
  getFiles,
  getDirectories,
  getActiveFile,
  createTextFile,
  createDirectory,
  deleteFile,
  deleteDirectory,
  upsertFile,
} from './store'
import type { TreeDirNode, TreeFileNode, TreeNode } from './types'
import { buildTree } from './tree'
import { detectFileKind } from './fileKind'
import { validatePath } from './paths'
import { fileBadge } from './fileBadge'
import {
  buildIcon,
  ICON_CHEVRON_DOWN,
  ICON_CHEVRON_RIGHT,
  ICON_FILE,
  ICON_FOLDER,
  ICON_FOLDER_OPEN,
  ICON_FOLDER_PLUS,
  ICON_IMG,
  ICON_MORE,
  ICON_PLUS,
  ICON_TRASH,
  ICON_UPLOAD,
} from './icons'
import { closeMenu, isMenuOpenFor, openMenu, type MenuItem } from './menu'
import { createResizeHandle } from './resize'
import {
  collectFilesFromDataTransfer,
  formatBytes,
  MAX_FILE_SIZE,
  pickRelativePath,
  readBrowserFile,
  SUPPORTED_EXTENSIONS,
  type CollectedItem,
} from './upload'

const PY_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_.-]*\.py$/

function validatePyName(raw: string): string | null {
  const name = raw.trim()
  if (!name) return 'ファイル名を入力してください'
  if (!PY_NAME_RE.test(name)) return '英数字・_・. で始まり、.py で終わる名前にしてください'
  return null
}

export type OnFileSelect = (path: string) => void
export type OnNotify = (message: string) => void

interface ExplorerHandle {
  refresh: () => void
}

// 非アクティブなファイルの削除はエディタ側に切替を伴わないため、
// 削除を知らせないとエディタが保持する当該ファイルの状態（undo履歴など）が残り続ける(issue #47)
export type OnFileDeleted = (path: string) => void
// アップロードで内容が確定したファイルを知らせる（新規追加・既存上書きのいずれも含む）。
// 既存ファイルの上書きはエディタ側に切替を伴わず無言で内容だけが変わるため、
// 講師モードの基準破棄などに使う（新規追加時は該当パスの基準がそもそも無いため無害）
export type OnFileUpserted = (path: string) => void

export interface CreateExplorerOptions {
  onFileSelect: OnFileSelect
  onError: OnNotify
  onFileDeleted: OnFileDeleted
  onFileUpserted: OnFileUpserted
}

export function createExplorer(
  container: HTMLElement,
  { onFileSelect, onError, onFileDeleted, onFileUpserted }: CreateExplorerOptions,
): ExplorerHandle {
  const expanded = new Set<string>()
  let dragDepth = 0

  const resizeHandle = createResizeHandle(container)

  function render(): void {
    closeMenu()
    const files = getFiles()
    const directories = getDirectories()
    const active = getActiveFile()
    const tree = buildTree(files, directories)
    autoExpand(tree, expanded, active)

    container.innerHTML = ''
    container.appendChild(buildHeader())

    const list = document.createElement('div')
    list.className = 'flex-1 overflow-y-auto py-1 min-h-0 relative'
    list.appendChild(renderTree(tree, active, 0))
    container.appendChild(list)
    container.appendChild(resizeHandle)

    attachDropHandlers(container, list)
  }

  function createNewFile(): void {
    const raw = window.prompt('ファイル名 (.py 必須):')
    if (raw === null) return
    const err = validatePyName(raw)
    if (err) { window.alert(err); return }
    const name = raw.trim()
    if (!createTextFile(name)) { window.alert(`"${name}" は既に存在します`); return }
    onFileSelect(name)
  }

  function createNewDirectory(): void {
    const raw = window.prompt('フォルダ名 (例: data または data/csv):')
    if (raw === null) return
    const err = validatePath(raw)
    if (err) { window.alert(err); return }
    const path = raw.trim().replace(/^\/+|\/+$/g, '')
    if (!createDirectory(path)) {
      window.alert(`"${path}" は既に存在します`)
      return
    }
    expanded.add(path)
    render()
  }

  const NEW_MENU_ITEMS: MenuItem[] = [
    { label: '新規ファイル (.py)', iconPath: ICON_FILE, onSelect: createNewFile },
    { label: '新規フォルダ', iconPath: ICON_FOLDER_PLUS, onSelect: createNewDirectory },
    { label: 'ファイルをアップロード', iconPath: ICON_UPLOAD, onSelect: () => openFilePicker(false) },
    { label: 'フォルダをアップロード', iconPath: ICON_FOLDER_OPEN, onSelect: () => openFilePicker(true) },
  ]

  // 追加操作（新規作成・アップロード）を1つのメニューにまとめたヘッダー
  function buildHeader(): HTMLElement {
    const header = document.createElement('div')
    header.className = 'flex items-center justify-between gap-1 px-3 py-2 bg-panel border-b border-line shrink-0'
    header.innerHTML = `
      <div class="flex items-center gap-1.5 min-w-0">
        ${buildIcon(ICON_FILE)}
        <span class="text-[11px] font-bold text-muted uppercase tracking-[0.08em] select-none truncate">ファイル</span>
      </div>
      <button
        id="explorerNewBtn"
        type="button"
        title="ファイル・フォルダを追加"
        aria-haspopup="menu"
        class="shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-md border border-line text-[11px] font-medium text-ink hover:bg-hover transition-colors cursor-pointer whitespace-nowrap"
      >${buildIcon(ICON_PLUS)}<span>新規</span>${buildIcon(ICON_CHEVRON_DOWN)}</button>
    `
    const newBtn = header.querySelector('#explorerNewBtn') as HTMLButtonElement
    newBtn.addEventListener('click', () => {
      if (isMenuOpenFor(newBtn)) { closeMenu(); return }
      const rect = newBtn.getBoundingClientRect()
      openMenu(NEW_MENU_ITEMS, { x: rect.left, y: rect.bottom + 4 }, newBtn)
    })
    return header
  }

  function openFilePicker(directory: boolean): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = SUPPORTED_EXTENSIONS.join(',')
    if (directory) {
      ;(input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true
    }
    input.addEventListener('change', async () => {
      const list = input.files
      if (!list || list.length === 0) return
      const items: CollectedItem[] = []
      for (let i = 0; i < list.length; i++) {
        const f = list[i]
        items.push({ file: f, relPath: pickRelativePath(f, f.name) })
      }
      await ingestItems(items)
    })
    input.click()
  }

  async function ingestItems(items: CollectedItem[]): Promise<void> {
    const errors: string[] = []
    let firstTextPath: string | null = null
    let count = 0

    for (const item of items) {
      const targetPath = item.relPath
      if (detectFileKind(targetPath) === null) {
        errors.push(`未対応の拡張子: ${targetPath}`)
        continue
      }
      if (item.file.size > MAX_FILE_SIZE) {
        errors.push(`サイズ上限 (${formatBytes(MAX_FILE_SIZE)}) 超過: ${targetPath}`)
        continue
      }
      try {
        const uploaded = await readBrowserFile(item.file, targetPath)
        upsertFile(uploaded.path, uploaded.content)
        onFileUpserted(uploaded.path)
        if (!firstTextPath && uploaded.content.kind === 'text') {
          firstTextPath = uploaded.path
        }
        count++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${targetPath}: ${msg}`)
      }
    }

    if (errors.length > 0) {
      onError(`${errors.length} 件のファイルをスキップしました:\n` + errors.join('\n'))
    }

    if (count > 0) {
      if (firstTextPath) {
        onFileSelect(firstTextPath)
      } else {
        render()
      }
    }
  }

  function attachDropHandlers(root: HTMLElement, list: HTMLElement): void {
    const overlay = document.createElement('div')
    overlay.className = 'hidden absolute inset-0 z-20 bg-accent/10 border-2 border-dashed border-accent pointer-events-none flex items-center justify-center'
    overlay.innerHTML = `<span class="text-xs text-accent font-bold">ここにドロップしてアップロード</span>`
    list.appendChild(overlay)

    function showOverlay(visible: boolean): void {
      overlay.classList.toggle('hidden', !visible)
    }

    root.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      dragDepth++
      showOverlay(true)
    })
    root.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    })
    root.addEventListener('dragleave', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) showOverlay(false)
    })
    root.addEventListener('drop', async (e) => {
      if (!e.dataTransfer) return
      e.preventDefault()
      dragDepth = 0
      showOverlay(false)
      const items = await collectFilesFromDataTransfer(e.dataTransfer.items)
      if (items.length === 0) return
      await ingestItems(items)
    })
  }

  function renderTree(nodes: TreeNode[], active: string, depth: number): HTMLElement {
    const ul = document.createElement('ul')
    ul.className = 'flex flex-col'
    for (const node of nodes) {
      ul.appendChild(node.type === 'dir'
        ? renderDir(node, active, depth)
        : renderFile(node, active, depth))
    }
    return ul
  }

  function removeDirectory(node: TreeDirNode): void {
    if (!window.confirm(`空のフォルダ "${node.path}/" を削除しますか？`)) return
    if (!deleteDirectory(node.path)) {
      window.alert('フォルダ内にファイルがあるため削除できません')
      return
    }
    expanded.delete(node.path)
    render()
  }

  function removeFile(node: TreeFileNode, active: string): void {
    if (!window.confirm(`"${node.path}" を削除しますか？`)) return
    const wasActive = node.path === active
    if (!deleteFile(node.path)) {
      window.alert('最後のテキストファイルは削除できません')
      return
    }
    onFileDeleted(node.path)
    if (wasActive) {
      onFileSelect(getActiveFile())
    } else {
      render()
    }
  }

  // 行末の「…」ボタンと右クリックで同じメニューを開く。常時表示にして発見しやすくする
  function attachRowMenu(row: HTMLElement, label: string, items: MenuItem[]): void {
    const moreBtn = document.createElement('button')
    moreBtn.type = 'button'
    moreBtn.className = 'shrink-0 mr-1 p-1 rounded text-muted opacity-60 group-hover:opacity-100 focus:opacity-100 hover:text-ink hover:bg-hover transition-all cursor-pointer'
    moreBtn.title = `${label} のメニュー`
    moreBtn.setAttribute('aria-label', `${label} のメニュー`)
    moreBtn.setAttribute('aria-haspopup', 'menu')
    moreBtn.innerHTML = buildIcon(ICON_MORE)
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (isMenuOpenFor(moreBtn)) { closeMenu(); return }
      const rect = moreBtn.getBoundingClientRect()
      openMenu(items, { x: rect.left, y: rect.bottom + 2 }, moreBtn)
    })
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      openMenu(items, { x: e.clientX, y: e.clientY })
    })
    row.appendChild(moreBtn)
  }

  // 階層の深さを示すガイド線（深さの数だけ縦線を並べる）
  function indentGuides(depth: number): HTMLElement[] {
    return Array.from({ length: depth }, () => {
      const guide = document.createElement('span')
      guide.className = 'inline-block w-3 self-stretch shrink-0 border-l border-line'
      return guide
    })
  }

  function nameSpan(text: string, extraClass = ''): HTMLElement {
    const span = document.createElement('span')
    span.className = `truncate ${extraClass}`.trim()
    span.textContent = text
    return span
  }

  function renderDir(node: TreeDirNode, active: string, depth: number): HTMLElement {
    const isOpen = expanded.has(node.path)
    const li = document.createElement('li')
    li.className = 'flex flex-col'

    const row = document.createElement('div')
    row.className = 'group relative flex items-center'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'flex-1 min-w-0 flex items-center gap-1.5 text-left pl-2 pr-1 py-1 text-xs font-mono font-medium text-ink border-l-2 border-transparent hover:bg-hover transition-colors cursor-pointer'
    btn.title = node.path
    btn.setAttribute('aria-expanded', String(isOpen))
    btn.append(...indentGuides(depth))
    btn.insertAdjacentHTML('beforeend', `<span class="text-muted">${buildIcon(isOpen ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT)}</span><span class="text-warn">${buildIcon(isOpen ? ICON_FOLDER_OPEN : ICON_FOLDER)}</span>`)
    btn.appendChild(nameSpan(node.name))
    btn.addEventListener('click', () => {
      if (isOpen) expanded.delete(node.path)
      else expanded.add(node.path)
      render()
    })

    row.appendChild(btn)
    attachRowMenu(row, `${node.path}/`, [
      { label: 'フォルダを削除', iconPath: ICON_TRASH, danger: true, onSelect: () => removeDirectory(node) },
    ])
    li.appendChild(row)

    if (isOpen && node.children.length > 0) {
      li.appendChild(renderTree(node.children, active, depth + 1))
    }
    return li
  }

  // ファイル名の前に出す種類表示。画像はアイコン、それ以外は拡張子のバッジ
  function fileMarker(node: TreeFileNode): HTMLElement {
    const marker = document.createElement('span')
    const badge = fileBadge(node.path)
    if (!badge) {
      marker.className = 'w-6 flex justify-center shrink-0'
      marker.innerHTML = buildIcon(ICON_IMG)
      return marker
    }
    marker.className = `w-6 shrink-0 text-center text-[9px] leading-none font-bold font-mono ${badge.colorClass}`
    marker.textContent = badge.label
    return marker
  }

  function renderFile(node: TreeFileNode, active: string, depth: number): HTMLElement {
    const isActive = node.path === active
    const li = document.createElement('li')
    li.className = 'group relative flex items-center'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = [
      'flex-1 min-w-0 flex items-center gap-1.5 text-left pl-2 pr-1 py-1 text-xs font-mono border-l-2 transition-colors cursor-pointer',
      isActive
        ? 'bg-accent/15 text-accent font-bold border-accent'
        : node.kind === 'binary'
          ? 'text-muted border-transparent hover:bg-hover'
          : 'text-ink border-transparent hover:bg-hover',
    ].join(' ')
    btn.title = node.path
    if (isActive) btn.setAttribute('aria-current', 'true')
    btn.append(...indentGuides(depth))
    btn.appendChild(fileMarker(node))
    btn.appendChild(nameSpan(node.name))

    btn.addEventListener('click', () => {
      if (node.kind === 'binary') {
        onError(`"${node.path}" はバイナリのため編集できません。Pythonから読み込んで使用してください。`)
        return
      }
      if (isActive) return
      onFileSelect(node.path)
    })

    li.appendChild(btn)
    attachRowMenu(li, node.path, [
      { label: '削除', iconPath: ICON_TRASH, danger: true, onSelect: () => removeFile(node, active) },
    ])
    return li
  }

  render()
  return { refresh: render }
}

function autoExpand(nodes: TreeNode[], expanded: Set<string>, activePath: string): void {
  if (!activePath.includes('/')) return
  const segments = activePath.split('/')
  segments.pop()
  let cur = ''
  for (const s of segments) {
    cur = cur ? `${cur}/${s}` : s
    expanded.add(cur)
  }
  // touch nodes to silence unused warning (reserved for future per-node defaults)
  void nodes
}
