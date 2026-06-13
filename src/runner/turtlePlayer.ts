import type { TurtleCommands } from '../types'
import {
  drawTurtleFrame,
  totalLength,
  cumulativeLengths,
  nextBoundary,
  drawnCount,
} from './turtleRenderer'

export type PlayMode = 'normal' | 'fast'

// 再生モードごとの目標再生時間（ms）。描画の大小に関わらず一定時間で再生するため、
// 速度は「合計長 / 再生時間」で算出する（速度固定より体感が安定する）。
const DURATION_MS: Record<PlayMode, number> = {
  normal: 4000,
  fast: 1200,
}

export interface PlayerState {
  playing: boolean
  mode: PlayMode | null
  atEnd: boolean
  drawn: number // 描画済みの線分本数
  count: number // 線分の総数
}

export interface TurtlePlayer {
  play: (mode: PlayMode) => void
  pause: () => void
  step: () => void
  reset: () => void
  destroy: () => void
}

// Canvas 上で turtle 描画をアニメーション再生するプレイヤーを生成する。
// 初期状態は完成形を表示し、play/step で最初から再描画する。
export function createTurtlePlayer(
  ctx: CanvasRenderingContext2D,
  data: TurtleCommands,
  width: number,
  height: number,
  onChange?: (state: PlayerState) => void,
): TurtlePlayer {
  const total = totalLength(data.segments)
  const cumulative = cumulativeLengths(data.segments)

  let distance = total // 初期表示は完成形
  let playing = false
  let mode: PlayMode | null = null
  let speed = 0 // px/秒
  let rafId = 0
  let lastTs = 0

  function render(): void {
    ctx.clearRect(0, 0, width, height)
    drawTurtleFrame(ctx, data, width, height, distance)
    onChange?.({
      playing,
      mode,
      atEnd: distance >= total,
      drawn: drawnCount(cumulative, distance),
      count: data.segments.length,
    })
  }

  function stop(): void {
    playing = false
    mode = null
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    lastTs = 0
  }

  function frame(ts: number): void {
    if (!playing) return
    if (!lastTs) lastTs = ts
    const dt = (ts - lastTs) / 1000
    lastTs = ts
    distance = Math.min(total, distance + speed * dt)
    if (distance >= total) {
      stop()
      render()
      return
    }
    render()
    rafId = requestAnimationFrame(frame)
  }

  function play(nextMode: PlayMode): void {
    if (total === 0) return
    stop()
    if (distance >= total) distance = 0 // 完成形なら最初から
    mode = nextMode
    speed = total / (DURATION_MS[nextMode] / 1000)
    playing = true
    rafId = requestAnimationFrame(frame)
  }

  function pause(): void {
    stop()
    render()
  }

  function step(): void {
    stop()
    if (distance >= total) distance = 0 // 完成形なら最初の 1 本から
    distance = nextBoundary(cumulative, distance)
    render()
  }

  function reset(): void {
    stop()
    distance = 0
    render()
  }

  function destroy(): void {
    stop()
  }

  render()
  return { play, pause, step, reset, destroy }
}
