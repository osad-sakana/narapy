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

function buildIcon(path: string): string {
  return `<svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="${path}"/>
  </svg>`
}

const ICON_PLUS         = 'M12 4.5v15m7.5-7.5h-15'
const ICON_CLOSE        = 'M6 18 18 6M6 6l12 12'
const ICON_FILE         = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z'
const ICON_FOLDER_PLUS  = 'M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44z'
const ICON_UPLOAD       = 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5'
const ICON_DIR_UP       = 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776'
const ICON_CHEVRON_DOWN = 'm19.5 8.25-7.5 7.5-7.5-7.5'
const ICON_CHEVRON_RIGHT= 'm8.25 4.5 7.5 7.5-7.5 7.5'
const ICON_DOC          = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6'
const ICON_IMG          = 'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z'

export type OnFileSelect = (path: string) => void
export type OnNotify = (message: string) => void

interface ExplorerHandle {
  refresh: () => void
}

// 非アクティブなファイルの削除はエディタ側に切替を伴わないため、
// 削除を知らせないとエディタが保持する当該ファイルの状態（undo履歴など）が残り続ける(issue #47)
export type OnFileDeleted = (path: string) => void
// アップロードによる既存ファイルの上書きを知らせる。非アクティブファイルの上書きは
// エディタ側に切替を伴わず無言で内容だけが変わるため、講師モードの基準破棄などに使う
export type OnFileReplaced = (path: string) => void

export function createExplorer(
  container: HTMLElement,
  onFileSelect: OnFileSelect,
  onError: OnNotify,
  onFileDeleted: OnFileDeleted,
  onFileReplaced: OnFileReplaced,
): ExplorerHandle {
  const expanded = new Set<string>()
  let dragDepth = 0

  function render(): void {
    const files = getFiles()
    const directories = getDirectories()
    const active = getActiveFile()
    const tree = buildTree(files, directories)
    autoExpand(tree, expanded, active)

    container.innerHTML = ''
    container.appendChild(buildHeader())
    container.appendChild(buildToolbar())

    const list = document.createElement('div')
    list.className = 'flex-1 overflow-y-auto py-1 min-h-0 relative'
    list.appendChild(renderTree(tree, active, 0))
    container.appendChild(list)

    attachDropHandlers(container, list)
  }

  function buildHeader(): HTMLElement {
    const header = document.createElement('div')
    header.className = 'flex items-center justify-between px-3 py-2.5 bg-panel border-b border-line shrink-0'
    header.innerHTML = `
      <div class="flex items-center gap-1.5">
        ${buildIcon(ICON_FILE)}
        <span class="text-[11px] font-bold text-muted uppercase tracking-[0.08em] select-none">ファイル</span>
      </div>
      <button
        id="explorerNewBtn"
        title="新規 .py ファイル"
        class="text-muted hover:text-ink transition-colors cursor-pointer"
      >${buildIcon(ICON_PLUS)}</button>
    `
    header.querySelector('#explorerNewBtn')!.addEventListener('click', () => {
      const raw = window.prompt('ファイル名 (.py 必須):')
      if (raw === null) return
      const err = validatePyName(raw)
      if (err) { window.alert(err); return }
      const name = raw.trim()
      if (!createTextFile(name)) { window.alert(`"${name}" は既に存在します`); return }
      onFileSelect(name)
    })
    return header
  }

  function buildToolbar(): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'flex items-center justify-between gap-1 px-2 py-1.5 border-b border-line shrink-0'
    bar.innerHTML = `
      <button id="explorerNewDirBtn"   title="新規フォルダ"      class="flex-1 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer py-1 rounded hover:bg-hover">${buildIcon(ICON_FOLDER_PLUS)}</button>
      <button id="explorerUploadBtn"   title="ファイルをアップロード" class="flex-1 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer py-1 rounded hover:bg-hover">${buildIcon(ICON_UPLOAD)}</button>
      <button id="explorerUploadDirBtn" title="フォルダをアップロード" class="flex-1 flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer py-1 rounded hover:bg-hover">${buildIcon(ICON_DIR_UP)}</button>
    `

    bar.querySelector('#explorerNewDirBtn')!.addEventListener('click', () => {
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
    })

    bar.querySelector('#explorerUploadBtn')!.addEventListener('click', () => {
      openFilePicker(false)
    })

    bar.querySelector('#explorerUploadDirBtn')!.addEventListener('click', () => {
      openFilePicker(true)
    })

    return bar
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
        onFileReplaced(uploaded.path)
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

  function renderDir(node: TreeDirNode, active: string, depth: number): HTMLElement {
    const isOpen = expanded.has(node.path)
    const li = document.createElement('li')
    li.className = 'flex flex-col'

    const row = document.createElement('div')
    row.className = 'group relative flex items-center'

    const btn = document.createElement('button')
    btn.className = 'flex-1 min-w-0 flex items-center gap-1 text-left px-2 py-1 text-xs font-mono text-muted hover:bg-hover hover:text-ink transition-colors cursor-pointer'
    btn.style.paddingLeft = `${depth * 12 + 8}px`
    btn.innerHTML = `${buildIcon(isOpen ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT)}<span class="truncate">${escapeHtml(node.name)}/</span>`
    btn.title = node.path
    btn.addEventListener('click', () => {
      if (isOpen) expanded.delete(node.path)
      else expanded.add(node.path)
      render()
    })

    const delBtn = document.createElement('button')
    delBtn.className = 'shrink-0 mr-1.5 opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all cursor-pointer p-0.5 rounded'
    delBtn.title = `${node.path}/ を削除`
    delBtn.innerHTML = buildIcon(ICON_CLOSE)
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!window.confirm(`空のフォルダ "${node.path}/" を削除しますか？`)) return
      if (!deleteDirectory(node.path)) {
        window.alert('フォルダ内にファイルがあるため削除できません')
        return
      }
      expanded.delete(node.path)
      render()
    })

    row.appendChild(btn)
    row.appendChild(delBtn)
    li.appendChild(row)

    if (isOpen && node.children.length > 0) {
      li.appendChild(renderTree(node.children, active, depth + 1))
    }
    return li
  }

  function renderFile(node: TreeFileNode, active: string, depth: number): HTMLElement {
    const isActive = node.path === active
    const li = document.createElement('li')
    li.className = 'group relative flex items-center'

    const btn = document.createElement('button')
    btn.className = [
      'flex-1 min-w-0 flex items-center gap-1 text-left px-2 py-1 text-xs font-mono truncate transition-colors cursor-pointer',
      isActive
        ? 'bg-accent/15 text-accent'
        : node.kind === 'binary'
          ? 'text-muted/70 hover:bg-hover hover:text-muted'
          : 'text-muted hover:bg-hover hover:text-ink',
    ].join(' ')
    btn.style.paddingLeft = `${depth * 12 + 8}px`
    btn.innerHTML = `${buildIcon(node.kind === 'binary' ? ICON_IMG : ICON_DOC)}<span class="truncate">${escapeHtml(node.name)}</span>`
    btn.title = node.path

    btn.addEventListener('click', () => {
      if (node.kind === 'binary') {
        onError(`"${node.path}" はバイナリのため編集できません。Pythonから読み込んで使用してください。`)
        return
      }
      if (isActive) return
      onFileSelect(node.path)
    })

    const delBtn = document.createElement('button')
    delBtn.className = 'shrink-0 mr-1.5 opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all cursor-pointer p-0.5 rounded'
    delBtn.title = `${node.path} を削除`
    delBtn.innerHTML = buildIcon(ICON_CLOSE)
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!window.confirm(`"${node.path}" を削除しますか？`)) return
      const wasActive = node.path === active
      if (!deleteFile(node.path)) {
        window.alert('最後のテキストファイルは削除できません')
        return
      }
      onFileDeleted(node.path)
      if (wasActive) {
        const next = getActiveFile()
        onFileSelect(next)
      } else {
        render()
      }
    })

    li.appendChild(btn)
    li.appendChild(delBtn)
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

