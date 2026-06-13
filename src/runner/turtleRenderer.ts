import type { TurtleCommands, TurtleSegment } from '../types'

// 描画を Canvas に収めるための表示変換。scale=1・cx=cy=0 が標準（原点中心・等倍）。
export interface View {
  scale: number
  cx: number // 表示中心にする turtle 座標 X
  cy: number // 表示中心にする turtle 座標 Y
}

const IDENTITY_VIEW: View = { scale: 1, cx: 0, cy: 0 }
const FIT_PADDING = 24

// 全線分のバウンディングボックスから表示変換を求める。
// Canvas に収まる場合は標準（原点中心・等倍）、はみ出す場合のみ縮小して中央寄せする。
export function computeView(
  segments: TurtleSegment[],
  width: number,
  height: number,
  padding: number = FIT_PADDING,
): View {
  if (segments.length === 0) return IDENTITY_VIEW

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2)
    maxX = Math.max(maxX, s.x1, s.x2)
    minY = Math.min(minY, s.y1, s.y2)
    maxY = Math.max(maxY, s.y1, s.y2)
  }

  const extent = Math.max(maxX - minX, maxY - minY)
  const avail = Math.min(width, height) - 2 * padding
  if (extent <= avail || extent <= 0) return IDENTITY_VIEW

  return {
    scale: avail / extent,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

const GRID_MINOR_COLOR = '#e6eaf1'
const GRID_AXIS_COLOR = '#c3cad6'

// 背景未指定のときに描く方眼。spacing px 間隔で、中央（turtle 原点）に必ず罫線がくるようにする。
export function drawGrid(
  ctx: DrawContext,
  width: number,
  height: number,
  spacing: number = 50,
): void {
  const cx = width / 2
  const cy = height / 2

  ctx.lineWidth = 1
  ctx.strokeStyle = GRID_MINOR_COLOR
  for (let x = cx; x <= width; x += spacing) verticalLine(ctx, x, height)
  for (let x = cx - spacing; x >= 0; x -= spacing) verticalLine(ctx, x, height)
  for (let y = cy; y <= height; y += spacing) horizontalLine(ctx, y, width)
  for (let y = cy - spacing; y >= 0; y -= spacing) horizontalLine(ctx, y, width)

  // 中央軸（原点を通る縦横線）を少し濃く描く
  ctx.strokeStyle = GRID_AXIS_COLOR
  verticalLine(ctx, cx, height)
  horizontalLine(ctx, cy, width)
}

function verticalLine(ctx: DrawContext, x: number, height: number): void {
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
}

function horizontalLine(ctx: DrawContext, y: number, width: number): void {
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(width, y)
  ctx.stroke()
}

// turtle 座標（中央原点・Y軸上向き）を Canvas 座標（左上原点・Y軸下向き）へ変換する。
export function turtleToCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
  view: View = IDENTITY_VIEW,
): { cx: number; cy: number } {
  return {
    cx: width / 2 + (x - view.cx) * view.scale,
    cy: height / 2 - (y - view.cy) * view.scale,
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

// 1 本の線分の長さ（turtle 座標 = Canvas 座標で 1:1 のためそのまま使える）。
export function segmentLength(seg: TurtleSegment): number {
  return Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
}

// 全線分の合計長。アニメーションの進捗（描画済み距離）の上限になる。
export function totalLength(segments: TurtleSegment[]): number {
  return segments.reduce((sum, s) => sum + segmentLength(s), 0)
}

// 各線分を描き終えた時点の累積距離（ステップ再生の境界に使う）。
export function cumulativeLengths(segments: TurtleSegment[]): number[] {
  const out: number[] = []
  let sum = 0
  for (const s of segments) {
    sum += segmentLength(s)
    out.push(sum)
  }
  return out
}

// distance の直後にくる線分境界（次のステップ位置）を返す。
export function nextBoundary(cumulative: number[], distance: number): number {
  const eps = 1e-6
  for (const c of cumulative) {
    if (c > distance + eps) return c
  }
  return cumulative.length > 0 ? cumulative[cumulative.length - 1] : 0
}

// distance までに完全に描き終えた線分の本数。
export function drawnCount(cumulative: number[], distance: number): number {
  const eps = 1e-6
  let n = 0
  for (const c of cumulative) {
    if (c <= distance + eps) n++
  }
  return n
}

// 描画済み距離 distance におけるタートルの位置・向き（turtle 座標）。
export function markerAt(
  data: TurtleCommands,
  distance: number,
): { x: number; y: number; heading: number } {
  let remaining = distance
  for (const seg of data.segments) {
    const len = segmentLength(seg)
    if (remaining < len) {
      const t = len === 0 ? 0 : remaining / len
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * t,
        y: seg.y1 + (seg.y2 - seg.y1) * t,
        heading: (Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) * 180) / Math.PI,
      }
    }
    remaining -= len
  }
  // 全線分を描き終えた場合は実際の最終状態を使う（最後の回転も反映される）。
  return { x: data.turtle.x, y: data.turtle.y, heading: data.turtle.heading }
}

function strokeLine(
  ctx: DrawContext,
  from: { cx: number; cy: number },
  to: { cx: number; cy: number },
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(from.cx, from.cy)
  ctx.lineTo(to.cx, to.cy)
  ctx.stroke()
}

// 描画済み距離 distance まで線分を描き、タートルマーカーを置く（1 フレーム分）。
// distance を totalLength にすると全体が描画される。
export function drawTurtleFrame(
  ctx: DrawContext,
  data: TurtleCommands,
  width: number,
  height: number,
  distance: number,
): void {
  ctx.lineCap = 'round'
  const view = computeView(data.segments, width, height)

  let remaining = distance
  for (const seg of data.segments) {
    if (remaining <= 0) break
    const len = segmentLength(seg)
    const from = turtleToCanvas(seg.x1, seg.y1, width, height, view)
    if (remaining >= len) {
      const to = turtleToCanvas(seg.x2, seg.y2, width, height, view)
      strokeLine(ctx, from, to, seg.color, seg.width)
      remaining -= len
    } else {
      // 線分の途中まで（アニメーション中の部分描画）
      const t = len === 0 ? 0 : remaining / len
      const mid = turtleToCanvas(
        seg.x1 + (seg.x2 - seg.x1) * t,
        seg.y1 + (seg.y2 - seg.y1) * t,
        width,
        height,
        view,
      )
      strokeLine(ctx, from, mid, seg.color, seg.width)
      remaining = 0
    }
  }

  if (data.turtle.visible) {
    const m = markerAt(data, distance)
    drawTurtleMarker(ctx, m.x, m.y, m.heading, width, height, view)
  }
}

// 全線分を一括描画する（プレビュー初期表示・テスト用）。
export function drawTurtleCommands(
  ctx: DrawContext,
  data: TurtleCommands,
  width: number,
  height: number,
): void {
  drawTurtleFrame(ctx, data, width, height, totalLength(data.segments))
}

// タートルの位置・向きを表す小さな三角形を描く（座標は turtle 座標）。
function drawTurtleMarker(
  ctx: DrawContext,
  x: number,
  y: number,
  heading: number,
  width: number,
  height: number,
  view: View = IDENTITY_VIEW,
): void {
  const center = turtleToCanvas(x, y, width, height, view)
  // turtle 座標系の角度（反時計回り）を Canvas の Y 反転に合わせて符号反転する。
  const rad = (-heading * Math.PI) / 180
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
