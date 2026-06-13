import type { TurtleCommands } from '../types'

// turtle 座標（中央原点・Y軸上向き）を Canvas 座標（左上原点・Y軸下向き）へ変換する。
export function turtleToCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
): { cx: number; cy: number } {
  return {
    cx: width / 2 + x,
    cy: height / 2 - y,
  }
}

// 最小限の Canvas 2D コンテキスト（描画に使う部分のみ）。テスト時のモックを許容する。
// strokeStyle/fillStyle は CanvasRenderingContext2D と同じ広い型にして実体を受け取れるようにする。
export interface DrawContext {
  strokeStyle: string | CanvasGradient | CanvasPattern
  fillStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap: CanvasLineCap
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  stroke: () => void
  fill: () => void
  closePath: () => void
}

const TURTLE_MARKER_SIZE = 8

// turtle の描画コマンドを Canvas へ描画する。
// 線分は color/width ごとに個別の path として描き、最後にタートル位置へ三角マーカーを置く。
export function drawTurtleCommands(
  ctx: DrawContext,
  data: TurtleCommands,
  width: number,
  height: number,
): void {
  ctx.lineCap = 'round'

  for (const seg of data.segments) {
    const from = turtleToCanvas(seg.x1, seg.y1, width, height)
    const to = turtleToCanvas(seg.x2, seg.y2, width, height)
    ctx.strokeStyle = seg.color
    ctx.lineWidth = seg.width
    ctx.beginPath()
    ctx.moveTo(from.cx, from.cy)
    ctx.lineTo(to.cx, to.cy)
    ctx.stroke()
  }

  if (data.turtle.visible) {
    drawTurtleMarker(ctx, data.turtle, width, height)
  }
}

// タートルの現在位置・向きを表す小さな三角形を描く。
function drawTurtleMarker(
  ctx: DrawContext,
  turtle: TurtleCommands['turtle'],
  width: number,
  height: number,
): void {
  const center = turtleToCanvas(turtle.x, turtle.y, width, height)
  // turtle 座標系の角度（反時計回り）を Canvas の Y 反転に合わせて符号反転する。
  const rad = (-turtle.heading * Math.PI) / 180
  const points = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((offset) => ({
    px: center.cx + TURTLE_MARKER_SIZE * Math.cos(rad + offset),
    py: center.cy + TURTLE_MARKER_SIZE * Math.sin(rad + offset),
  }))

  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.moveTo(points[0].px, points[0].py)
  ctx.lineTo(points[1].px, points[1].py)
  ctx.lineTo(points[2].px, points[2].py)
  ctx.closePath()
  ctx.fill()
}
