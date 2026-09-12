import { buildVarList } from './varList'
import type { VarWithChange } from '../trace/varDiff'
import type { StepSpeed } from '../trace/session'

const SPEED_LABELS: Record<StepSpeed, string> = { 1: '遅', 2: '普通', 3: '速' }

export type StepperAction =
  | { type: 'first' | 'prev' | 'next' | 'last' | 'togglePlay' | 'close' }
  | { type: 'seek'; index: number }
  | { type: 'speed'; speed: StepSpeed }

export interface RenderState {
  index: number
  total: number
  playing: boolean
  speed: StepSpeed
  funcName: string
  line: number
  vars: VarWithChange[]
  globalsVars: VarWithChange[] | null
  truncated: boolean
  hasError: boolean
  canPrev: boolean
  canNext: boolean
}

export interface StepperUI {
  show: () => void
  hide: () => void
  render: (state: RenderState) => void
  onAction: (handler: (action: StepperAction) => void) => void
}

interface ControlRefs {
  root: HTMLElement
  firstBtn: HTMLButtonElement
  prevBtn: HTMLButtonElement
  playBtn: HTMLButtonElement
  nextBtn: HTMLButtonElement
  lastBtn: HTMLButtonElement
}

function buildHeader(onClose: () => void): HTMLElement {
  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-3 py-2.5 border-b border-line shrink-0'

  const title = document.createElement('span')
  title.className = 'text-[11px] font-bold text-muted uppercase tracking-[0.08em]'
  title.textContent = 'ステップ実行'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.title = '閉じる'
  closeBtn.className = 'text-muted hover:text-ink transition-colors cursor-pointer text-sm leading-none'
  closeBtn.textContent = '✕'
  closeBtn.addEventListener('click', onClose)

  header.append(title, closeBtn)
  return header
}

function controlButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = title
  btn.className = 'flex-1 px-1.5 py-1 rounded-md border border-line text-xs hover:bg-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default'
  btn.textContent = label
  btn.addEventListener('click', onClick)
  return btn
}

function buildControls(dispatch: (action: StepperAction) => void): ControlRefs {
  const root = document.createElement('div')
  root.className = 'flex items-center gap-1'

  const firstBtn = controlButton('⏮', '最初のステップへ', () => dispatch({ type: 'first' }))
  const prevBtn = controlButton('◀', '前のステップへ', () => dispatch({ type: 'prev' }))
  const playBtn = controlButton('▶', '自動再生', () => dispatch({ type: 'togglePlay' }))
  const nextBtn = controlButton('→', '次のステップへ', () => dispatch({ type: 'next' }))
  const lastBtn = controlButton('⏭', '最後のステップへ', () => dispatch({ type: 'last' }))

  root.append(firstBtn, prevBtn, playBtn, nextBtn, lastBtn)
  return { root, firstBtn, prevBtn, playBtn, nextBtn, lastBtn }
}

function buildSpeedRow(
  dispatch: (action: StepperAction) => void,
): { root: HTMLElement; buttons: Map<StepSpeed, HTMLButtonElement> } {
  const root = document.createElement('div')
  root.className = 'flex items-center gap-1 text-xs text-muted'

  const label = document.createElement('span')
  label.textContent = '再生速度:'
  root.appendChild(label)

  const buttons = new Map<StepSpeed, HTMLButtonElement>()
  for (const speed of [1, 2, 3] as const) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'px-1.5 py-0.5 rounded border border-line hover:bg-hover transition-colors cursor-pointer'
    btn.textContent = SPEED_LABELS[speed]
    btn.addEventListener('click', () => dispatch({ type: 'speed', speed }))
    buttons.set(speed, btn)
    root.appendChild(btn)
  }
  return { root, buttons }
}

function buildBanner(className: string, text: string): HTMLElement {
  const banner = document.createElement('div')
  banner.className = `hidden px-2 py-1.5 rounded-md text-xs ${className}`
  banner.textContent = text
  return banner
}

interface BodyRefs {
  root: HTMLElement
  controls: ControlRefs
  speedRow: { root: HTMLElement; buttons: Map<StepSpeed, HTMLButtonElement> }
  slider: HTMLInputElement
  positionRow: HTMLElement
  truncatedBanner: HTMLElement
  errorBanner: HTMLElement
  frameLabel: HTMLElement
  varsContainer: HTMLElement
  globalsDetails: HTMLDetailsElement
  globalsContainer: HTMLElement
}

function buildVarsSection(): { heading: HTMLElement; container: HTMLElement } {
  const heading = document.createElement('div')
  heading.className = 'text-[11px] font-bold text-muted uppercase tracking-[0.08em]'
  heading.textContent = '変数'
  const container = document.createElement('div')
  return { heading, container }
}

function buildGlobalsSection(): { details: HTMLDetailsElement; container: HTMLElement } {
  const details = document.createElement('details')
  details.className = 'hidden text-xs'
  const summary = document.createElement('summary')
  summary.className = 'text-[11px] font-bold text-muted uppercase tracking-[0.08em] cursor-pointer'
  summary.textContent = 'グローバル変数'
  const container = document.createElement('div')
  container.className = 'mt-1.5'
  details.append(summary, container)
  return { details, container }
}

function buildBody(dispatch: (action: StepperAction) => void): BodyRefs {
  const controls = buildControls(dispatch)
  const speedRow = buildSpeedRow(dispatch)

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.className = 'w-full cursor-pointer'
  slider.min = '0'
  slider.setAttribute('aria-label', 'ステップ位置')
  slider.addEventListener('input', () => dispatch({ type: 'seek', index: Number(slider.value) }))

  const positionRow = document.createElement('div')
  positionRow.className = 'text-xs font-mono text-muted'

  const truncatedBanner = buildBanner('bg-warn/15 text-warn', 'ステップ数が多いため、途中から先の行の記録を省略しています')
  const errorBanner = buildBanner('bg-danger/15 text-danger', 'この実行はエラーで終了しました（詳細は実行ログを確認してください）')

  const frameLabel = document.createElement('div')
  frameLabel.className = 'text-xs text-muted font-mono'

  const { heading: varsHeading, container: varsContainer } = buildVarsSection()
  const { details: globalsDetails, container: globalsContainer } = buildGlobalsSection()

  const root = document.createElement('div')
  root.className = 'flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-sm'
  root.append(
    positionRow, controls.root, slider, speedRow.root,
    truncatedBanner, errorBanner, frameLabel,
    varsHeading, varsContainer, globalsDetails,
  )

  return {
    root, controls, speedRow, slider, positionRow,
    truncatedBanner, errorBanner, frameLabel, varsContainer, globalsDetails, globalsContainer,
  }
}

export function createStepperUI(): StepperUI {
  const panel = document.getElementById('stepPanel') as HTMLElement
  let actionHandler: ((action: StepperAction) => void) | null = null
  const dispatch = (action: StepperAction): void => actionHandler?.(action)

  panel.replaceChildren()

  const header = buildHeader(() => dispatch({ type: 'close' }))
  const body = buildBody(dispatch)

  panel.append(header, body.root)

  function show(): void {
    panel.classList.remove('hidden')
    panel.classList.add('flex')
  }

  function hide(): void {
    panel.classList.add('hidden')
    panel.classList.remove('flex')
  }

  function render(state: RenderState): void {
    const { controls, speedRow, slider, positionRow, truncatedBanner, errorBanner, frameLabel, varsContainer, globalsDetails, globalsContainer } = body

    positionRow.textContent = `${state.index + 1} / ${state.total} ステップ`
    slider.max = String(Math.max(0, state.total - 1))
    slider.value = String(state.index)

    controls.playBtn.textContent = state.playing ? '⏸' : '▶'
    controls.firstBtn.disabled = !state.canPrev
    controls.prevBtn.disabled = !state.canPrev
    controls.nextBtn.disabled = !state.canNext
    controls.lastBtn.disabled = !state.canNext

    for (const [speed, btn] of speedRow.buttons) {
      const active = speed === state.speed
      btn.classList.toggle('bg-accent/15', active)
      btn.classList.toggle('text-accent', active)
      btn.classList.toggle('border-accent/40', active)
    }

    truncatedBanner.classList.toggle('hidden', !state.truncated)
    errorBanner.classList.toggle('hidden', !state.hasError)
    frameLabel.textContent = `${state.funcName}() — ${state.line}行目`

    varsContainer.replaceChildren(buildVarList(state.vars))
    if (state.globalsVars) {
      globalsDetails.classList.remove('hidden')
      globalsContainer.replaceChildren(buildVarList(state.globalsVars))
    } else {
      globalsDetails.classList.add('hidden')
    }
  }

  return {
    show,
    hide,
    render,
    onAction: (handler) => { actionHandler = handler },
  }
}
