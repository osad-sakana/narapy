import Split from 'split.js'

const STORAGE_KEY = 'narapy-layout-v1'

interface LayoutState {
  horizontal: [number, number]
  vertical: [number, number]
  blocklyCollapsed: boolean
}

const DEFAULT_STATE: LayoutState = {
  horizontal: [50, 50],
  vertical: [60, 40],
  blocklyCollapsed: false,
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
  btn.title = collapsed ? 'ブロックエディタを展開' : 'ブロックエディタを折りたたむ'
  const svg = btn.querySelector('svg')
  // < アイコンを 180度回転 → > になる（展開方向）
  if (svg) svg.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)'
}

export function initLayout(): void {
  const state = load()

  const hSplit = Split(['#blocklyPanel', '#rightPanel'], {
    sizes: state.horizontal,
    minSize: [0, 240],
    snapOffset: 30,
    gutterSize: 6,
    direction: 'horizontal',
    cursor: 'col-resize',
    gutterStyle: () => ({ 'flex-shrink': '0' }),
    onDragEnd: (sizes) => {
      save({ horizontal: [sizes[0], sizes[1]], blocklyCollapsed: sizes[0] < 5 })
      window.dispatchEvent(new Event('resize'))
    },
  })

  Split(['#editorPanel', '#logPanel'], {
    sizes: state.vertical,
    minSize: [60, 60],
    gutterSize: 6,
    direction: 'vertical',
    cursor: 'row-resize',
    gutterStyle: () => ({ 'flex-shrink': '0' }),
    onDragEnd: (sizes) => {
      save({ vertical: [sizes[0], sizes[1]] })
    },
  })

  // Blocklyパネル折りたたみトグル
  const collapseBtn = document.getElementById('blocklyCollapseBtn')
  if (!collapseBtn) return

  let collapsed = state.blocklyCollapsed
  setCollapseIcon(collapseBtn, collapsed)

  if (collapsed) {
    hSplit.collapse(0)
    window.dispatchEvent(new Event('resize'))
  }

  collapseBtn.addEventListener('click', () => {
    collapsed = !collapsed
    if (collapsed) {
      hSplit.collapse(0)
    } else {
      const saved = load()
      const sizes: [number, number] =
        saved.horizontal[0] < 5 ? DEFAULT_STATE.horizontal : saved.horizontal
      hSplit.setSizes(sizes)
    }
    setCollapseIcon(collapseBtn, collapsed)
    save({ blocklyCollapsed: collapsed })
    window.dispatchEvent(new Event('resize'))
  })
}
