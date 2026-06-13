import type { TurtleCommands } from '../types'
import { drawTurtleCommands } from './turtleRenderer'

const CANVAS_SIZE = 480

// turtle の描画データを Canvas に描画し、モーダルで表示する（figureModal と同パターン）。
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
  canvas.className = 'max-w-full max-h-[80vh] object-contain'
  canvas.setAttribute('aria-label', 'turtle 描画')

  const ctx = canvas.getContext('2d')
  if (ctx) {
    drawTurtleCommands(ctx, data, CANVAS_SIZE, CANVAS_SIZE)
  }

  header.appendChild(titleEl)
  header.appendChild(closeBtn)
  canvasContainer.appendChild(canvas)
  card.appendChild(header)
  card.appendChild(canvasContainer)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const close = (): void => {
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
