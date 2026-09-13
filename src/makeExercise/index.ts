import { createEditor, getValue, setValue, type EditorInstance } from '../editor/index'
import { initFontSizeControls } from '../editor/fontSize'
import { encodeProjectParam } from '../urlload/encode'
import { addRow, removeRow, updateRow, type FileRowState } from '../makeUrl/fileRows'
import { buildExerciseFromRows } from './buildExercise'
import { initTheme } from '../theme/index'

function init(): void {
  // createEditor が解決済みテーマを読むため先に実行する
  initTheme()

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

  // 動作確認できる最小構成をデフォルトにする（issue #65）
  let rows: FileRowState[] = [
    { path: 'main.py', content: 'def add(a, b):\n    # ここを実装してください\n    pass\n' },
    { path: 'problem.md', content: '# 二数の和\n\nadd(a, b) という関数を実装してください。\n引数 a・b を受け取り、その和を返す関数です。\n' },
    { path: 'test.py', content: 'def test_add():\n    assert add(1, 2) == 3\n\ndef test_add_negative():\n    assert add(-3, 5) == 2\n' },
  ]
  let activeIndex = 0
  let problemIndex = 1
  let testIndex = 2
  let rowEditors: EditorInstance[] = []

  // 本体アプリ(main.ts)が動くNarapyのURL(現在のページのディレクトリ)をデフォルト値にする
  baseUrlInput.value = new URL('.', window.location.href).toString()

  function disposeRowEditors(): void {
    for (const editor of rowEditors) editor.dispose()
    rowEditors = []
  }

  function createRoleRadio(name: string, title: string, checked: boolean, onChange: () => void): HTMLLabelElement {
    const label = document.createElement('label')
    label.className = 'flex items-center gap-1 text-[11px] text-muted whitespace-nowrap cursor-pointer'

    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = name
    radio.checked = checked
    radio.className = 'accent-accent shrink-0'
    radio.addEventListener('change', onChange)

    label.append(radio, document.createTextNode(title))
    return label
  }

  function renderFileRows(): void {
    disposeRowEditors()
    fileRowsContainer.replaceChildren()
    rows.forEach((row, index) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'border border-line rounded-lg p-3 space-y-2 bg-panel'

      const topRow = document.createElement('div')
      topRow.className = 'flex items-center gap-2 flex-wrap'

      const roles = document.createElement('div')
      roles.className = 'flex items-center gap-3 shrink-0'
      roles.append(
        createRoleRadio('entryFile', '採点対象', index === activeIndex, () => { activeIndex = index }),
        createRoleRadio('problemFile', '問題文', index === problemIndex, () => { problemIndex = index }),
        createRoleRadio('testFile', 'テスト', index === testIndex, () => { testIndex = index }),
      )

      const pathInput = document.createElement('input')
      pathInput.type = 'text'
      pathInput.value = row.path
      pathInput.placeholder = 'path/to/file'
      pathInput.className = 'flex-1 min-w-32 font-mono text-xs bg-editor border border-line rounded px-2 py-1 focus:outline-none focus:border-accent'
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
        // 削除した行より後ろを指していたインデックスは1つ詰める。削除した行自体を
        // 指していた役割は割り当て先を失うため、範囲内に収めるだけに留め（重複は
        // buildExerciseFromRows 側のバリデーションでエラーにする)、無言で誤った
        // ファイルが役割に居座らないようにする。
        const reindex = (idx: number): number =>
          idx > index ? idx - 1 : Math.min(idx, rows.length - 1)
        activeIndex = reindex(activeIndex)
        problemIndex = reindex(problemIndex)
        testIndex = reindex(testIndex)
        renderFileRows()
      })

      topRow.append(roles, pathInput, removeBtn)

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

  addFileRowBtn.addEventListener('click', () => {
    rows = addRow(rows)
    renderFileRows()
  })

  generateBtn.addEventListener('click', () => {
    errorMessage.classList.add('hidden')
    resultSection.classList.add('hidden')

    const base = baseUrlInput.value.trim() || new URL('.', window.location.href).toString()
    try {
      const project = buildExerciseFromRows(rows, activeIndex, problemIndex, testIndex)
      const url = `${base}#project=${encodeProjectParam(project)}`
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

  // 本体アプリ(main.ts)と同じlocalStorageキーでフォントサイズを共有する
  initFontSizeControls((size) => {
    for (const editor of rowEditors) editor.updateOptions({ fontSize: size })
  })
}

init()
