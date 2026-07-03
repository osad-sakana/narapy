import Split from 'split.js'

const STORAGE_KEY = 'narapy-layout-v1'

interface LayoutState {
  horizontal: [number, number]
  vertical: [number, number]
  blocklyCollapsed: boolean
  editorCollapsed: boolean
  logCollapsed: boolean
}

const DEFAULT_STATE: LayoutState = {
  horizontal: [50, 50],
  vertical: [60, 40],
  blocklyCollapsed: false,
  editorCollapsed: false,
  logCollapsed: false,
}

const BTN_ACTIVE: Record<'blockly' | 'python' | 'log', string> = {
  blockly: 'text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer bg-sky-500/15 text-sky-300 border border-sky-600/40',
  python:  'text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer bg-violet-500/15 text-violet-300 border border-violet-600/40',
  log:     'text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer bg-emerald-500/15 text-emerald-300 border border-emerald-600/40',
}
const BTN_INACTIVE = 'text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer text-slate-600 border border-transparent hover:text-slate-400'

// Blocklyパネルの表示状態（Python→Blockly変換を行うべきかの判定に使う）
let blocklyPanelHidden = false
let blocklyVisibilityListener: ((hidden: boolean) => void) | null = null

export function isBlocklyPanelHidden(): boolean {
  return blocklyPanelHidden
}

// initLayout() の呼び出しタイミングを変えずに済むよう、
// 可視性変化の通知先はコールバック引数ではなくリスナー登録で分離する
export function onBlocklyPanelVisibilityChange(listener: (hidden: boolean) => void): void {
  blocklyVisibilityListener = listener
}

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

export function initLayout(blocklyEnabled: boolean): void {
  const state = load()

  blocklyPanelHidden = blocklyEnabled ? state.blocklyCollapsed : true

  const blocklyPanel = document.getElementById('blocklyPanel') as HTMLElement
  const rightPanel   = document.getElementById('rightPanel')   as HTMLElement
  const emptyMessage = document.getElementById('emptyMessage') as HTMLElement
  const mainEl       = document.querySelector('main')          as HTMLElement

  function setBlocklyCollapsed(next: boolean): void {
    blocklyCollapsed = next
    if (blocklyPanelHidden === next) return
    blocklyPanelHidden = next
    blocklyVisibilityListener?.(next)
  }

  // Blockly無効時はパネル自体を初期化せず、右パネル（エディタ+ログ）を全幅表示する
  let hSplit: ReturnType<typeof Split> | null = null
  if (blocklyEnabled) {
    hSplit = Split(['#blocklyPanel', '#rightPanel'], {
      sizes: state.horizontal,
      minSize: [0, 0],
      snapOffset: 30,
      gutterSize: 6,
      direction: 'horizontal',
      cursor: 'col-resize',
      gutterStyle: () => ({ 'flex-shrink': '0' }),
      onDragEnd: (sizes) => {
        setBlocklyCollapsed(sizes[0] < 5)
        save({ horizontal: [sizes[0], sizes[1]], blocklyCollapsed })
        updateAll()
        window.dispatchEvent(new Event('resize'))
      },
    })
  } else {
    blocklyPanel.style.display = 'none'
    rightPanel.style.flex = '1 1 auto'
  }

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

  const hGutter = mainEl.querySelector<HTMLElement>('.gutter.gutter-horizontal')

  let { blocklyCollapsed, editorCollapsed, logCollapsed } = state
  if (!blocklyEnabled) blocklyCollapsed = true

  const blocklyBtn = document.getElementById('panelToggleBlockly') as HTMLElement
  const pythonBtn  = document.getElementById('panelTogglePython')  as HTMLElement
  const logBtn     = document.getElementById('panelToggleLog')      as HTMLElement

  if (!blocklyEnabled) blocklyBtn.style.display = 'none'

  function updateBtnStyles(): void {
    blocklyBtn.className = blocklyCollapsed ? BTN_INACTIVE : BTN_ACTIVE.blockly
    pythonBtn.className  = editorCollapsed  ? BTN_INACTIVE : BTN_ACTIVE.python
    logBtn.className     = logCollapsed     ? BTN_INACTIVE : BTN_ACTIVE.log
  }

  function updateEmptyMessage(): void {
    const allGone = blocklyCollapsed && editorCollapsed && logCollapsed
    if (allGone) {
      blocklyPanel.style.visibility = 'hidden'
      rightPanel.style.visibility   = 'hidden'
      if (hGutter) hGutter.style.visibility = 'hidden'
      emptyMessage.style.display = 'flex'
    } else {
      blocklyPanel.style.visibility = ''
      rightPanel.style.visibility   = ''
      if (hGutter) hGutter.style.visibility = ''
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

  // --- ブロックトグル ---
  if (blocklyEnabled) {
    blocklyBtn.addEventListener('click', () => {
      setBlocklyCollapsed(!blocklyCollapsed)
      if (blocklyCollapsed) {
        hSplit!.collapse(0)
      } else {
        const saved = load()
        hSplit!.setSizes(saved.horizontal[0] < 5 ? DEFAULT_STATE.horizontal : saved.horizontal)
      }
      save({ blocklyCollapsed })
      updateAll()
      window.dispatchEvent(new Event('resize'))
    })
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
  if (blocklyEnabled && blocklyCollapsed) {
    hSplit!.collapse(0)
    window.dispatchEvent(new Event('resize'))
  }
  syncVSplit()
  updateAll()
}
