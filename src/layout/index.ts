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

function setCollapseIcon(btn: HTMLElement, collapsed: boolean): void {
  const svg = btn.querySelector('svg')
  if (svg) svg.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)'
}

export function initLayout(): void {
  const state = load()

  const blocklyPanel = document.getElementById('blocklyPanel') as HTMLElement
  const rightPanel   = document.getElementById('rightPanel')   as HTMLElement
  const emptyMessage = document.getElementById('emptyMessage') as HTMLElement
  const mainEl       = document.querySelector('main')          as HTMLElement

  const hSplit = Split(['#blocklyPanel', '#rightPanel'], {
    sizes: state.horizontal,
    minSize: [0, 0],
    snapOffset: 30,
    gutterSize: 6,
    direction: 'horizontal',
    cursor: 'col-resize',
    gutterStyle: () => ({ 'flex-shrink': '0' }),
    onDragEnd: (sizes) => {
      blocklyCollapsed = sizes[0] < 5
      save({ horizontal: [sizes[0], sizes[1]], blocklyCollapsed })
      updateVisibility()
      window.dispatchEvent(new Event('resize'))
    },
  })

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
      updateVisibility()
    },
  })

  const hGutter = mainEl.querySelector<HTMLElement>('.gutter.gutter-horizontal')

  let { blocklyCollapsed, editorCollapsed, logCollapsed } = state

  function updateVisibility(): void {
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

  // エディタとログの collapse/expand を同期する
  // 片方だけ折りたたまれている場合は collapse(index) で対応
  // 両方折りたたまれている場合は visibility で対応（split.js は触らない）
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

  // --- Blockly トグル ---
  const blocklyBtn = document.getElementById('blocklyCollapseBtn') as HTMLElement | null
  if (blocklyBtn) {
    setCollapseIcon(blocklyBtn, blocklyCollapsed)
    blocklyBtn.title = blocklyCollapsed ? 'ブロックエディタを展開' : 'ブロックエディタを折りたたむ'

    if (blocklyCollapsed) {
      hSplit.collapse(0)
      window.dispatchEvent(new Event('resize'))
    }

    blocklyBtn.addEventListener('click', () => {
      blocklyCollapsed = !blocklyCollapsed
      if (blocklyCollapsed) {
        hSplit.collapse(0)
      } else {
        const saved = load()
        hSplit.setSizes(saved.horizontal[0] < 5 ? DEFAULT_STATE.horizontal : saved.horizontal)
      }
      setCollapseIcon(blocklyBtn, blocklyCollapsed)
      blocklyBtn.title = blocklyCollapsed ? 'ブロックエディタを展開' : 'ブロックエディタを折りたたむ'
      save({ blocklyCollapsed })
      updateVisibility()
      window.dispatchEvent(new Event('resize'))
    })
  }

  // --- エディタ トグル ---
  const editorBtn = document.getElementById('editorCollapseBtn') as HTMLElement | null
  if (editorBtn) {
    setCollapseIcon(editorBtn, editorCollapsed)
    editorBtn.title = editorCollapsed ? 'Pythonエディタを展開' : 'Pythonエディタを折りたたむ'

    if (editorCollapsed) syncVSplit()

    editorBtn.addEventListener('click', () => {
      editorCollapsed = !editorCollapsed
      syncVSplit()
      setCollapseIcon(editorBtn, editorCollapsed)
      editorBtn.title = editorCollapsed ? 'Pythonエディタを展開' : 'Pythonエディタを折りたたむ'
      save({ editorCollapsed })
      updateVisibility()
    })
  }

  // --- ログ トグル ---
  const logBtn = document.getElementById('logCollapseBtn') as HTMLElement | null
  if (logBtn) {
    setCollapseIcon(logBtn, logCollapsed)
    logBtn.title = logCollapsed ? '実行ログを展開' : '実行ログを折りたたむ'

    if (logCollapsed) syncVSplit()

    logBtn.addEventListener('click', () => {
      logCollapsed = !logCollapsed
      syncVSplit()
      setCollapseIcon(logBtn, logCollapsed)
      logBtn.title = logCollapsed ? '実行ログを展開' : '実行ログを折りたたむ'
      save({ logCollapsed })
      updateVisibility()
    })
  }

  // --- 全パネル復元ボタン ---
  const restoreBtn = document.getElementById('restoreAllBtn') as HTMLElement | null
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      blocklyCollapsed = false
      editorCollapsed  = false
      logCollapsed     = false
      hSplit.setSizes(DEFAULT_STATE.horizontal)
      vSplit.setSizes(DEFAULT_STATE.vertical)
      if (blocklyBtn) {
        setCollapseIcon(blocklyBtn, false)
        blocklyBtn.title = 'ブロックエディタを折りたたむ'
      }
      if (editorBtn) {
        setCollapseIcon(editorBtn, false)
        editorBtn.title = 'Pythonエディタを折りたたむ'
      }
      if (logBtn) {
        setCollapseIcon(logBtn, false)
        logBtn.title = '実行ログを折りたたむ'
      }
      save({ blocklyCollapsed: false, editorCollapsed: false, logCollapsed: false })
      updateVisibility()
      window.dispatchEvent(new Event('resize'))
    })
  }

  updateVisibility()
}
