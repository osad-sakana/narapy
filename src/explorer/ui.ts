import { getFiles, getActiveFile, createFile, deleteFile } from './store'

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

const ICON_PLUS   = 'M12 4.5v15m7.5-7.5h-15'
const ICON_CLOSE  = 'M6 18 18 6M6 6l12 12'
const ICON_FILE   = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z'

export type OnFileSelect = (name: string) => void

export function createExplorer(
  container: HTMLElement,
  onFileSelect: OnFileSelect,
): { refresh: () => void } {
  function render(): void {
    const files = getFiles()
    const active = getActiveFile()

    container.innerHTML = ''

    // ─── header ───
    const header = document.createElement('div')
    header.className = 'flex items-center justify-between px-3 py-2.5 bg-[#180a2e] border-b border-violet-700/50 border-l-4 border-l-violet-400 shrink-0'
    header.innerHTML = `
      <div class="flex items-center gap-1.5">
        ${buildIcon(ICON_FILE)}
        <span class="text-xs font-bold text-violet-300 uppercase tracking-widest select-none">ファイル</span>
      </div>
      <button
        id="explorerNewBtn"
        title="新規ファイル"
        class="text-violet-500 hover:text-violet-200 transition-colors cursor-pointer"
      >${buildIcon(ICON_PLUS)}</button>
    `
    container.appendChild(header)

    header.querySelector('#explorerNewBtn')!.addEventListener('click', () => {
      const raw = window.prompt('ファイル名 (.py 必須):')
      if (raw === null) return
      const err = validatePyName(raw)
      if (err) { window.alert(err); return }
      const name = raw.trim()
      if (!createFile(name)) { window.alert(`"${name}" は既に存在します`); return }
      onFileSelect(name)
    })

    // ─── file list ───
    const list = document.createElement('ul')
    list.className = 'flex-1 overflow-y-auto py-1 min-h-0'

    for (const file of files) {
      const isActive = file.name === active
      const li = document.createElement('li')
      li.className = 'group relative flex items-center'

      const btn = document.createElement('button')
      btn.className = [
        'flex-1 min-w-0 text-left px-3 py-1.5 text-xs font-mono truncate transition-colors cursor-pointer',
        isActive
          ? 'bg-violet-500/20 text-violet-100'
          : 'text-slate-400 hover:bg-violet-500/10 hover:text-slate-200',
      ].join(' ')
      btn.textContent = file.name
      btn.title = file.name

      btn.addEventListener('click', () => {
        if (isActive) return
        onFileSelect(file.name)
      })

      const delBtn = document.createElement('button')
      delBtn.className = 'shrink-0 mr-1.5 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all cursor-pointer p-0.5 rounded'
      delBtn.title = `${file.name} を削除`
      delBtn.innerHTML = buildIcon(ICON_CLOSE)

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!window.confirm(`"${file.name}" を削除しますか？`)) return
        const wasActive = file.name === active
        if (!deleteFile(file.name)) {
          window.alert('最後のファイルは削除できません')
          return
        }
        if (wasActive) {
          onFileSelect(getFiles()[0].name)
        } else {
          render()
        }
      })

      li.appendChild(btn)
      li.appendChild(delBtn)
      list.appendChild(li)
    }

    container.appendChild(list)
  }

  render()
  return { refresh: render }
}
