import { createEditor, getValue, setValue, type EditorInstance } from '../editor/index'
import { initFontSizeControls } from '../editor/fontSize'
import { encodeCodeParam, encodeProjectParam } from '../urlload/encode'
import { buildProjectFromRows } from './buildProject'
import { addRow, removeRow, updateRow, type FileRowState } from './fileRows'

type Mode = 'code' | 'project'

function init(): void {
  const modeCodeBtn = document.getElementById('modeCodeBtn') as HTMLButtonElement
  const modeProjectBtn = document.getElementById('modeProjectBtn') as HTMLButtonElement
  const codeSection = document.getElementById('codeModeSection') as HTMLElement
  const projectSection = document.getElementById('projectModeSection') as HTMLElement
  const codeEditorContainer = document.getElementById('codeEditor') as HTMLElement
  const fileRowsContainer = document.getElementById('fileRows') as HTMLElement
  const addFileRowBtn = document.getElementById('addFileRowBtn') as HTMLButtonElement
  const baseUrlInput = document.getElementById('baseUrlInput') as HTMLInputElement
  const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement
  const errorMessage = document.getElementById('errorMessage') as HTMLElement
  const resultSection = document.getElementById('resultSection') as HTMLElement
  const resultUrl = document.getElementById('resultUrl') as HTMLInputElement
  const resultSize = document.getElementById('resultSize') as HTMLElement
  const copyResultBtn = document.getElementById('copyResultBtn') as HTMLButtonElement
  const openResultBtn = document.getElementById('openResultBtn') as HTMLButtonElement

  let mode: Mode = 'code'
  let rows: FileRowState[] = [
    { path: 'main.py', content: 'from util import greet\n\nprint(greet())' },
    { path: 'util.py', content: 'def greet():\n    return "Hello from util.py!"' },
  ]
  let activeIndex = 0
  let rowEditors: EditorInstance[] = []

  const codeEditor = createEditor(codeEditorContainer)
  setValue(codeEditor, 'print("Hello, Narapy!")')

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
      btn.classList.toggle('bg-accent/15', active)
      btn.classList.toggle('text-accent', active)
      btn.classList.toggle('border-accent/40', active)
      btn.classList.toggle('text-muted', !active)
      btn.classList.toggle('border-transparent', !active)
    }
  }

  function disposeRowEditors(): void {
    for (const editor of rowEditors) editor.dispose()
    rowEditors = []
  }

  function renderFileRows(): void {
    disposeRowEditors()
    fileRowsContainer.replaceChildren()
    rows.forEach((row, index) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'border border-line rounded-lg p-3 space-y-2 bg-panel'

      const topRow = document.createElement('div')
      topRow.className = 'flex items-center gap-2'

      const activeRadio = document.createElement('input')
      activeRadio.type = 'radio'
      activeRadio.name = 'activeFile'
      activeRadio.checked = index === activeIndex
      activeRadio.title = '開いた状態にするファイル'
      activeRadio.className = 'accent-accent shrink-0'
      activeRadio.addEventListener('change', () => {
        activeIndex = index
      })

      const pathInput = document.createElement('input')
      pathInput.type = 'text'
      pathInput.value = row.path
      pathInput.placeholder = 'path/to/file.py'
      pathInput.className = 'flex-1 font-mono text-xs bg-editor border border-line rounded px-2 py-1 focus:outline-none focus:border-accent'
      pathInput.addEventListener('input', () => {
        rows = updateRow(rows, index, { path: pathInput.value })
      })

      const removable = rows.length > 1
      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.textContent = '削除'
      removeBtn.disabled = !removable
      removeBtn.className = removable
        ? 'text-xs text-danger hover:opacity-80 transition-opacity cursor-pointer shrink-0'
        : 'text-xs text-danger/30 cursor-not-allowed shrink-0'
      removeBtn.addEventListener('click', () => {
        if (rows.length <= 1) return
        rows = removeRow(rows, index)
        if (activeIndex >= rows.length) activeIndex = rows.length - 1
        renderFileRows()
      })

      topRow.append(activeRadio, pathInput, removeBtn)

      const editorContainer = document.createElement('div')
      editorContainer.className = 'h-40 rounded overflow-hidden border border-line'

      wrapper.append(topRow, editorContainer)
      fileRowsContainer.appendChild(wrapper)

      const rowEditor = createEditor(editorContainer)
      setValue(rowEditor, row.content)
      rowEditor.onDidChangeModelContent(() => {
        rows = updateRow(rows, index, { content: getValue(rowEditor) })
      })
      rowEditors.push(rowEditor)
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
        ? `code=${encodeCodeParam(getValue(codeEditor))}`
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

  openResultBtn.addEventListener('click', () => {
    if (!resultUrl.value) return
    window.open(resultUrl.value, '_blank', 'noopener,noreferrer')
  })

  renderFileRows()
  setMode('code')

  // 本体アプリ(main.ts)と同じlocalStorageキーでフォントサイズを共有する
  initFontSizeControls((size) => {
    codeEditor.updateOptions({ fontSize: size })
    for (const editor of rowEditors) editor.updateOptions({ fontSize: size })
  })
}

init()
