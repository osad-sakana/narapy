import { Events } from 'blockly'
import type { WorkspaceSvg, Block } from 'blockly'

interface TooltipData {
  title: string
  description: string
  example: string
  output: string
}

const BLOCK_TOOLTIPS: Partial<Record<string, TooltipData>> = {
  text_print: {
    title: 'print(値, ...)',
    description: '値をコンソールに出力します。複数の値をカンマで渡すとスペース区切りで出力されます。',
    example: 'print("Hello, World!")\nprint("x =", 42)\nprint(True, None)',
    output: 'Hello, World!\nx = 42\nTrue None',
  },
}

let enabled = true
let tooltipEl: HTMLDivElement | null = null

export function setTooltipsEnabled(value: boolean): void {
  enabled = value
  if (!value && tooltipEl) tooltipEl.style.display = 'none'
}

export function isTooltipsEnabled(): boolean {
  return enabled
}

// .blocklyFlyout の祖先を持つ要素のみ対象（ワークスペースブロックを除外）
function getBlockFromFlyout(el: Element, workspace: WorkspaceSvg): Block | null {
  if (!el.closest('.blocklyFlyout')) return null
  const blockEl = el.closest('[data-id]')
  if (!blockEl) return null
  const id = blockEl.getAttribute('data-id')
  if (!id) return null
  return workspace.getFlyout()?.getWorkspace().getBlockById(id) ?? null
}

function renderTooltip(el: HTMLElement, data: TooltipData): void {
  el.innerHTML = `
    <div class="bt-title"></div>
    <p class="bt-desc"></p>
    <div class="bt-section">
      <div class="bt-section-label">例</div>
      <pre class="bt-code"></pre>
    </div>
    <div class="bt-section bt-section-out">
      <div class="bt-section-label">▸ 出力</div>
      <pre class="bt-out"></pre>
    </div>
  `
  el.querySelector('.bt-title')!.textContent = data.title
  el.querySelector('.bt-desc')!.textContent = data.description
  el.querySelector('.bt-code')!.textContent = data.example
  el.querySelector('.bt-out')!.textContent = data.output
}

function positionTooltip(el: HTMLElement, pos: { clientX: number; clientY: number }): void {
  const OFFSET = 18
  el.style.visibility = 'hidden'
  el.style.display = 'block'
  void el.offsetHeight // force reflow
  const { width, height } = el.getBoundingClientRect()

  let x = pos.clientX + OFFSET
  let y = pos.clientY + OFFSET
  if (x + width  > window.innerWidth  - 8) x = pos.clientX - width  - OFFSET
  if (y + height > window.innerHeight - 8) y = pos.clientY - height - OFFSET

  el.style.left = `${Math.max(8, x)}px`
  el.style.top  = `${Math.max(8, y)}px`
  el.style.visibility = 'visible'
}

export function initBlockTooltips(blocklyDiv: HTMLElement, workspace: WorkspaceSvg): void {
  tooltipEl = document.createElement('div')
  tooltipEl.id = 'bt-root'
  tooltipEl.style.display = 'none'
  document.body.appendChild(tooltipEl)

  let currentType: string | null = null

  function hide(): void {
    tooltipEl!.style.display = 'none'
    currentType = null
  }

  // Blockly 自身のドラッグ開始イベントでツールチップを消す（DOM イベント不使用）
  workspace.addChangeListener((event) => {
    if (event.type === Events.BLOCK_DRAG) {
      const isStart = (event as unknown as { isStart?: boolean }).isStart
      if (isStart) hide()
    }
  })

  blocklyDiv.addEventListener('mousemove', (e: MouseEvent) => {
    if (!enabled) return

    const block = getBlockFromFlyout(e.target as Element, workspace)
    const data = block ? BLOCK_TOOLTIPS[block.type] : undefined

    if (!data) {
      hide()
      return
    }

    if (block!.type !== currentType) {
      currentType = block!.type
      renderTooltip(tooltipEl!, data)
    }
    positionTooltip(tooltipEl!, { clientX: e.clientX, clientY: e.clientY })
  })

  blocklyDiv.addEventListener('mouseleave', hide)
}
