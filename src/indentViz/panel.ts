import type { EditorInstance } from '../editor/index'
import { isPythonPath } from '../explorer/fileKind'
import { BTN_ACTIVE, HEADER_BTN_STYLES } from '../layout/index'
import { getLocalStorage, loadOpenState, saveOpenState } from './openState'
import { parseIndentTree } from './parse'
import { renderTree } from './render'
import { attachResize, loadWidth, saveWidth } from './resize'

const RENDER_DEBOUNCE_MS = 150
const BTN_INACTIVE = HEADER_BTN_STYLES[0]

function message(text: string): HTMLElement {
  const el = document.createElement('p')
  el.className = 'text-xs text-muted p-1'
  el.textContent = text
  return el
}

/** 解析・描画に失敗しても（極端に深い入れ子など）パネルを空白のまま固めない */
function buildContent(source: string): HTMLElement {
  try {
    const tree = parseIndentTree(source)
    return tree.length > 0 ? renderTree(tree) : message('表示できるコードがありません。')
  } catch {
    return message('このコードは構造を表示できませんでした。')
  }
}

/** エディタ上端に見えている行の最初のブロックまでパネルをスクロールする */
function syncScroll(editor: EditorInstance, body: HTMLElement): void {
  const top = editor.getVisibleRanges()[0]?.startLineNumber
  if (top === undefined) return
  const target = [...body.querySelectorAll<HTMLElement>('[data-line]')]
    .find(el => Number(el.dataset.line) >= top)
  if (!target) return
  body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top
}

/**
 * 今開いているスクリプトのインデント構造をサイドパネルに常時反映する。
 * パネルが閉じている間は解析も描画もしない。
 */
export function initIndentVizPanel(editor: EditorInstance, getPath: () => string): void {
  const panel = document.getElementById('vizPanel')
  const body = document.getElementById('vizPanelBody')
  const toggle = document.getElementById('panelToggleViz')
  const handle = document.getElementById('vizPanelResizeHandle')
  if (!panel || !body || !toggle || !handle) return

  const storage = getLocalStorage()
  let open = loadOpenState(storage)
  let timer: number | undefined

  function render(): void {
    if (!open) return
    // .csv / .txt など Python 以外もエディタで開けるので、構造として読もうとしない
    const content = isPythonPath(getPath()) ? buildContent(editor.getValue()) : message('Python ファイル（.py）を開くと構造が表示されます。')
    body!.replaceChildren(content)
    syncScroll(editor, body!)
  }

  function scheduleRender(): void {
    if (!open) return
    window.clearTimeout(timer)
    timer = window.setTimeout(render, RENDER_DEBOUNCE_MS)
  }

  function apply(): void {
    // 狭い画面では常にエディタを優先する（max-md:hidden は flex より後に出力されるため勝つ）
    panel!.classList.toggle('hidden', !open)
    panel!.classList.toggle('flex', open)
    toggle!.className = open ? BTN_ACTIVE : BTN_INACTIVE
    toggle!.setAttribute('aria-pressed', String(open))
  }

  toggle.addEventListener('click', () => {
    open = !open
    saveOpenState(storage, open)
    apply()
    render()
  })

  editor.onDidChangeModelContent(scheduleRender)
  // ファイル切替はモデルの差し替えなので、内容変更とは別に拾う
  editor.onDidChangeModel(() => {
    window.clearTimeout(timer)
    render()
  })
  editor.onDidScrollChange(e => {
    if (open && e.scrollTopChanged) syncScroll(editor, body!)
  })

  attachResize({
    panel,
    handle,
    initialWidth: loadWidth(storage),
    onCommit: width => saveWidth(storage, width),
  })

  apply()
  render()
}
