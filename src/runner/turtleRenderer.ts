import type { TurtleCommands, TurtleSegment } from '../types'

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

  let remaining = distance
  for (const seg of data.segments) {
    if (remaining <= 0) break
    const len = segmentLength(seg)
    const from = turtleToCanvas(seg.x1, seg.y1, width, height)
    if (remaining >= len) {
      const to = turtleToCanvas(seg.x2, seg.y2, width, height)
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
      )
      strokeLine(ctx, from, mid, seg.color, seg.width)
      remaining = 0
    }
  }

  if (data.turtle.visible) {
    const m = markerAt(data, distance)
    drawTurtleMarker(ctx, m.x, m.y, m.heading, width, height)
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
): void {
  const center = turtleToCanvas(x, y, width, height)
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
