import { encodeCodeParam, encodeProjectParam } from '../urlload/encode'
import { buildProjectFromRows } from './buildProject'
import { addRow, removeRow, updateRow, type FileRowState } from './fileRows'

type Mode = 'code' | 'project'

function init(): void {
  const modeCodeBtn = document.getElementById('modeCodeBtn') as HTMLButtonElement
  const modeProjectBtn = document.getElementById('modeProjectBtn') as HTMLButtonElement
  const codeSection = document.getElementById('codeModeSection') as HTMLElement
  const projectSection = document.getElementById('projectModeSection') as HTMLElement
  const codeInput = document.getElementById('codeInput') as HTMLTextAreaElement
  const fileRowsContainer = document.getElementById('fileRows') as HTMLElement
  const addFileRowBtn = document.getElementById('addFileRowBtn') as HTMLButtonElement
  const baseUrlInput = document.getElementById('baseUrlInput') as HTMLInputElement
  const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement
  const errorMessage = document.getElementById('errorMessage') as HTMLElement
  const resultSection = document.getElementById('resultSection') as HTMLElement
  const resultUrl = document.getElementById('resultUrl') as HTMLInputElement
  const resultSize = document.getElementById('resultSize') as HTMLElement
  const copyResultBtn = document.getElementById('copyResultBtn') as HTMLButtonElement

  let mode: Mode = 'code'
  let rows: FileRowState[] = [
    { path: 'main.py', content: 'from util import greet\n\nprint(greet())' },
    { path: 'util.py', content: 'def greet():\n    return "Hello from util.py!"' },
  ]
  let activeIndex = 0

  // main.tsが動くNarapy本体のURL(現在のページのディレクトリ)をデフォルト値にする
  baseUrlInput.value = new URL('.', window.location.href).toString()

  function setMode(next: Mode): void {
    mode = next
    codeSection.classList.toggle('hidden', mode !== 'code')
    projectSection.classList.toggle('hidden', mode !== 'project')
    for (const [btn, active] of [
      [modeCodeBtn, mode === 'code'],
      [modeProjectBtn, mode === 'project'],
    ] as const) {
      btn.classList.toggle('bg-violet-500/20', active)
      btn.classList.toggle('text-violet-200', active)
      btn.classList.toggle('border-violet-500/40', active)
      btn.classList.toggle('text-slate-400', !active)
      btn.classList.toggle('border-transparent', !active)
    }
  }

  function renderFileRows(): void {
    fileRowsContainer.replaceChildren()
    rows.forEach((row, index) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'border border-violet-900/40 rounded-lg p-3 space-y-2 bg-[#0c0818]'

      const topRow = document.createElement('div')
      topRow.className = 'flex items-center gap-2'

      const activeRadio = document.createElement('input')
      activeRadio.type = 'radio'
      activeRadio.name = 'activeFile'
      activeRadio.checked = index === activeIndex
      activeRadio.title = '開いた状態にするファイル'
      activeRadio.className = 'accent-violet-500 shrink-0'
      activeRadio.addEventListener('change', () => {
        activeIndex = index
      })

      const pathInput = document.createElement('input')
      pathInput.type = 'text'
      pathInput.value = row.path
      pathInput.placeholder = 'path/to/file.py'
      pathInput.className = 'flex-1 font-mono text-xs bg-[#08080d] border border-violet-800/40 rounded px-2 py-1 focus:outline-none focus:border-violet-500'
      pathInput.addEventListener('input', () => {
        rows = updateRow(rows, index, { path: pathInput.value })
      })

      const removable = rows.length > 1
      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.textContent = '削除'
      removeBtn.disabled = !removable
      removeBtn.className = removable
        ? 'text-xs text-rose-400 hover:text-rose-200 transition-colors cursor-pointer shrink-0'
        : 'text-xs text-rose-900 cursor-not-allowed shrink-0'
      removeBtn.addEventListener('click', () => {
        if (rows.length <= 1) return
        rows = removeRow(rows, index)
        if (activeIndex >= rows.length) activeIndex = rows.length - 1
        renderFileRows()
      })

      topRow.append(activeRadio, pathInput, removeBtn)

      const contentInput = document.createElement('textarea')
      contentInput.rows = 5
      contentInput.spellcheck = false
      contentInput.value = row.content
      contentInput.className = 'w-full font-mono text-xs bg-[#08080d] border border-violet-800/40 rounded p-2 focus:outline-none focus:border-violet-500'
      contentInput.addEventListener('input', () => {
        rows = updateRow(rows, index, { content: contentInput.value })
      })

      wrapper.append(topRow, contentInput)
      fileRowsContainer.appendChild(wrapper)
    })
  }

  function showError(message: string): void {
    errorMessage.textContent = message
    errorMessage.classList.remove('hidden')
    resultSection.classList.add('hidden')
  }

  modeCodeBtn.addEventListener('click', () => setMode('code'))
  modeProjectBtn.addEventListener('click', () => setMode('project'))
  addFileRowBtn.addEventListener('click', () => {
    rows = addRow(rows)
    renderFileRows()
  })

  generateBtn.addEventListener('click', () => {
    errorMessage.classList.add('hidden')
    resultSection.classList.add('hidden')

    const base = baseUrlInput.value.trim() || new URL('.', window.location.href).toString()
    try {
      const hashParam = mode === 'code'
        ? `code=${encodeCodeParam(codeInput.value)}`
        : `project=${encodeProjectParam(buildProjectFromRows(rows, activeIndex))}`
      const url = `${base}#${hashParam}`
      resultUrl.value = url
      resultSize.textContent = `URLの長さ: ${url.length.toLocaleString()} 文字`
      resultSection.classList.remove('hidden')
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err))
    }
  })

  copyResultBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(resultUrl.value)
  })

  renderFileRows()
  setMode('code')
}

init()
