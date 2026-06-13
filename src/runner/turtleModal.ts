import type { TurtleCommands } from '../types'
import { createTurtlePlayer, type PlayerState } from './turtlePlayer'

const CANVAS_SIZE = 480

const BTN_BASE = 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer'
const BTN_PLAY = `${BTN_BASE} bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white`
const BTN_SUB = `${BTN_BASE} bg-slate-600 hover:bg-slate-500 active:bg-slate-700 text-white`

// turtle の描画データを Canvas に描画し、再生コントロール付きモーダルで表示する。
export function showTurtleModal(data: TurtleCommands): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-slate-800 rounded-xl shadow-2xl overflow-hidden max-w-3xl flex flex-col'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-4 py-2 bg-slate-700 flex-shrink-0'

  const titleEl = document.createElement('span')
  titleEl.className = 'text-slate-200 text-sm font-medium'
  titleEl.textContent = '🐢 Turtle'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-slate-400 hover:text-white text-xl font-bold transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-slate-600'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')

  const canvasContainer = document.createElement('div')
  canvasContainer.className = 'overflow-auto p-2 flex items-center justify-center bg-white'

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  canvas.className = 'max-w-full max-h-[70vh] object-contain'
  canvas.setAttribute('aria-label', 'turtle 描画')

  // 再生コントロールバー
  const controls = document.createElement('div')
  controls.className = 'flex items-center gap-2 flex-wrap px-4 py-2.5 bg-slate-700 border-t border-slate-600 flex-shrink-0'

  const playBtn = createButton('▶ 通常再生', BTN_PLAY)
  const fastBtn = createButton('⏩ 高速再生', BTN_PLAY)
  const stepBtn = createButton('⏭ ステップ', BTN_SUB)
  const pauseBtn = createButton('⏸ 一時停止', BTN_SUB)
  const resetBtn = createButton('↺ 最初から', BTN_SUB)

  const progress = document.createElement('span')
  progress.className = 'ml-auto text-xs text-slate-300 font-mono tabular-nums'

  controls.append(playBtn, fastBtn, stepBtn, pauseBtn, resetBtn, progress)

  header.append(titleEl, closeBtn)
  canvasContainer.appendChild(canvas)
  card.append(header, canvasContainer, controls)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const ctx = canvas.getContext('2d')
  const player = ctx
    ? createTurtlePlayer(ctx, data, CANVAS_SIZE, CANVAS_SIZE, (state) => updateControls(state))
    : null

  function updateControls(state: PlayerState): void {
    progress.textContent = `${state.drawn} / ${state.count} 本`
    pauseBtn.disabled = !state.playing
    pauseBtn.classList.toggle('opacity-40', !state.playing)
    pauseBtn.classList.toggle('cursor-not-allowed', !state.playing)
  }

  playBtn.addEventListener('click', () => player?.play('normal'))
  fastBtn.addEventListener('click', () => player?.play('fast'))
  stepBtn.addEventListener('click', () => player?.step())
  pauseBtn.addEventListener('click', () => player?.pause())
  resetBtn.addEventListener('click', () => player?.reset())

  const close = (): void => {
    player?.destroy()
    backdrop.remove()
    document.removeEventListener('keydown', handleKey)
  }

  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }

  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', handleKey)
}

function createButton(label: string, className: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = className
  btn.textContent = label
  return btn
}
