import Split from 'split.js'

const STORAGE_KEY = 'narapy-layout-v1'

interface LayoutState {
  vertical: [number, number]
  editorCollapsed: boolean
  logCollapsed: boolean
}

const DEFAULT_STATE: LayoutState = {
  vertical: [60, 40],
  editorCollapsed: false,
  logCollapsed: false,
}

// ヘッダー幅が狭くなってもラベルが潰れたり縦積みに折り返したりしないよう、
// whitespace-nowrap + shrink-0 を全パネルトグル共通で必須にする
const BTN_BASE = 'text-xs px-2 lg:px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0'

// パネルごとの色分け（sky / violet / emerald）はニュートラル配色への移行で廃止し、
// 表示中かどうかだけを単一アクセントで示す
export const BTN_ACTIVE = `${BTN_BASE} bg-accent/15 text-accent border border-accent/40`
const BTN_INACTIVE = `${BTN_BASE} text-muted border border-transparent hover:text-ink hover:bg-hover`

// BTN_INACTIVE は BTN_ACTIVE と違い index.html との完全一致テストで間接的に
// 守られていない（初期状態では常にACTIVE側が使われるため）。回帰ガード用に
// パネルトグルの全スタイルをまとめて公開する。
export const HEADER_BTN_STYLES = [BTN_INACTIVE, BTN_ACTIVE]

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<LayoutState>) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function save(patch: Partial<LayoutState>): void {
  const current = load()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }))
}

export function initLayout(): void {
  const state = load()

  const rightPanel   = document.getElementById('rightPanel')   as HTMLElement
  const emptyMessage = document.getElementById('emptyMessage') as HTMLElement

  const vSplit = Split(['#editorPanel', '#logPanel'], {
    sizes: state.vertical,
    minSize: [0, 0],
    gutterSize: 6,
    direction: 'vertical',
    cursor: 'row-resize',
    gutterStyle: () => ({ 'flex-shrink': '0' }),
    onDragEnd: (sizes) => {
      editorCollapsed = sizes[0] < 5
      logCollapsed    = sizes[1] < 5
      save({ vertical: [sizes[0], sizes[1]], editorCollapsed, logCollapsed })
      updateAll()
    },
  })

  let { editorCollapsed, logCollapsed } = state

  const pythonBtn  = document.getElementById('panelTogglePython')  as HTMLElement
  const logBtn     = document.getElementById('panelToggleLog')      as HTMLElement

  function updateBtnStyles(): void {
    pythonBtn.className  = editorCollapsed  ? BTN_INACTIVE : BTN_ACTIVE
    logBtn.className     = logCollapsed     ? BTN_INACTIVE : BTN_ACTIVE
  }

  function updateEmptyMessage(): void {
    const allGone = editorCollapsed && logCollapsed
    if (allGone) {
      rightPanel.style.visibility   = 'hidden'
      emptyMessage.style.display = 'flex'
    } else {
      rightPanel.style.visibility   = ''
      emptyMessage.style.display = 'none'
    }
  }

  // エディタ/ログの縦分割状態を同期する
  // 両方 collapsed の場合は visibility で対応し、split.js には触れない
  function syncVSplit(): void {
    if (editorCollapsed && logCollapsed) return
    if (editorCollapsed) {
      vSplit.collapse(0)
    } else if (logCollapsed) {
      vSplit.collapse(1)
    } else {
      const saved = load()
      vSplit.setSizes(saved.vertical[0] < 5 ? DEFAULT_STATE.vertical : saved.vertical)
    }
  }

  function updateAll(): void {
    updateBtnStyles()
    updateEmptyMessage()
  }

  // --- Python エディタトグル ---
  pythonBtn.addEventListener('click', () => {
    editorCollapsed = !editorCollapsed
    syncVSplit()
    save({ editorCollapsed })
    updateAll()
  })

  // --- 実行ログトグル ---
  logBtn.addEventListener('click', () => {
    logCollapsed = !logCollapsed
    syncVSplit()
    save({ logCollapsed })
    updateAll()
  })

  // 初期状態を適用
  syncVSplit()
  updateAll()
}
