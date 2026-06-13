import { describe, it, expect } from 'vitest'
import {
  turtleToCanvas,
  computeView,
  drawGrid,
  drawTurtleCommands,
  drawTurtleFrame,
  segmentLength,
  totalLength,
  cumulativeLengths,
  nextBoundary,
  drawnCount,
  markerAt,
  type DrawContext,
} from './turtleRenderer'
import type { TurtleCommands, TurtleSegment } from '../types'

describe('turtleToCanvas', () => {
  const W = 400
  const H = 400

  it('原点はキャンバス中央へ変換される', () => {
    expect(turtleToCanvas(0, 0, W, H)).toEqual({ cx: 200, cy: 200 })
  })

  it('Y軸は反転する（turtle の上=Canvas の上）', () => {
    expect(turtleToCanvas(0, 100, W, H)).toEqual({ cx: 200, cy: 100 })
    expect(turtleToCanvas(0, -100, W, H)).toEqual({ cx: 200, cy: 300 })
  })

  it('X軸はそのまま中央基準でオフセットされる', () => {
    expect(turtleToCanvas(50, 0, W, H)).toEqual({ cx: 250, cy: 200 })
    expect(turtleToCanvas(-50, 0, W, H)).toEqual({ cx: 150, cy: 200 })
  })
})

// moveTo / lineTo / stroke の呼び出しと、その時点の strokeStyle・lineWidth を記録するモック。
interface Call {
  method: string
  args: number[]
  strokeStyle?: string | CanvasGradient | CanvasPattern
  lineWidth?: number
}

function createMockContext(): { ctx: DrawContext; calls: Call[] } {
  const calls: Call[] = []
  const ctx: DrawContext = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    beginPath: () => calls.push({ method: 'beginPath', args: [] }),
    moveTo: (x, y) => calls.push({ method: 'moveTo', args: [x, y], strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }),
    lineTo: (x, y) => calls.push({ method: 'lineTo', args: [x, y], strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }),
    stroke: () => calls.push({ method: 'stroke', args: [] }),
    fill: () => calls.push({ method: 'fill', args: [] }),
    closePath: () => calls.push({ method: 'closePath', args: [] }),
  }
  return { ctx, calls }
}

describe('drawTurtleCommands', () => {
  const W = 400
  const H = 400

  it('線分が変換後の Canvas 座標・色・線幅で描画される', () => {
    const data: TurtleCommands = {
      segments: [
        { x1: 0, y1: 0, x2: 100, y2: 0, color: 'red', width: 3 },
      ],
      turtle: { x: 100, y: 0, heading: 0, visible: false },
    }
    const { ctx, calls } = createMockContext()
    drawTurtleCommands(ctx, data, W, H)

    const moveTo = calls.find((c) => c.method === 'moveTo')
    const lineTo = calls.find((c) => c.method === 'lineTo')
    expect(moveTo?.args).toEqual([200, 200])
    expect(lineTo?.args).toEqual([300, 200])
    expect(lineTo?.strokeStyle).toBe('red')
    expect(lineTo?.lineWidth).toBe(3)
    expect(calls.some((c) => c.method === 'stroke')).toBe(true)
  })

  it('visible=false のときタートルマーカー（fill）を描かない', () => {
    const data: TurtleCommands = {
      segments: [{ x1: 0, y1: 0, x2: 10, y2: 0, color: 'black', width: 1 }],
      turtle: { x: 10, y: 0, heading: 0, visible: false },
    }
    const { ctx, calls } = createMockContext()
    drawTurtleCommands(ctx, data, W, H)
    expect(calls.some((c) => c.method === 'fill')).toBe(false)
  })

  it('visible=true のときタートルマーカー（fill）を描く', () => {
    const data: TurtleCommands = {
      segments: [],
      turtle: { x: 0, y: 0, heading: 0, visible: true },
    }
    const { ctx, calls } = createMockContext()
    drawTurtleCommands(ctx, data, W, H)
    expect(calls.some((c) => c.method === 'fill')).toBe(true)
  })

  it('複数線分をすべて描画する', () => {
    const data: TurtleCommands = {
      segments: [
        { x1: 0, y1: 0, x2: 100, y2: 0, color: 'black', width: 1 },
        { x1: 100, y1: 0, x2: 100, y2: 100, color: 'black', width: 1 },
      ],
      turtle: { x: 100, y: 100, heading: 90, visible: false },
    }
    const { ctx, calls } = createMockContext()
    drawTurtleCommands(ctx, data, W, H)
    expect(calls.filter((c) => c.method === 'stroke')).toHaveLength(2)
  })
})

// L字（横100 + 縦100）の固定データを使う
const L_SEGMENTS: TurtleSegment[] = [
  { x1: 0, y1: 0, x2: 100, y2: 0, color: 'black', width: 1 },
  { x1: 100, y1: 0, x2: 100, y2: 100, color: 'black', width: 1 },
]
const L_DATA: TurtleCommands = {
  segments: L_SEGMENTS,
  turtle: { x: 100, y: 100, heading: 90, visible: true },
}

describe('長さ計算ヘルパー', () => {
  it('segmentLength は線分長を返す', () => {
    expect(segmentLength(L_SEGMENTS[0])).toBe(100)
    expect(segmentLength({ x1: 0, y1: 0, x2: 3, y2: 4, color: 'x', width: 1 })).toBe(5)
  })

  it('totalLength は合計長を返す', () => {
    expect(totalLength(L_SEGMENTS)).toBe(200)
    expect(totalLength([])).toBe(0)
  })

  it('cumulativeLengths は累積長を返す', () => {
    expect(cumulativeLengths(L_SEGMENTS)).toEqual([100, 200])
  })

  it('drawnCount は描画済み本数を返す', () => {
    expect(drawnCount([100, 200], 0)).toBe(0)
    expect(drawnCount([100, 200], 100)).toBe(1)
    expect(drawnCount([100, 200], 150)).toBe(1)
    expect(drawnCount([100, 200], 200)).toBe(2)
  })
})

describe('nextBoundary（ステップ再生の境界）', () => {
  const cumulative = [100, 200]

  it('現在地の次の境界へ進む', () => {
    expect(nextBoundary(cumulative, 0)).toBe(100)
    expect(nextBoundary(cumulative, 100)).toBe(200)
    expect(nextBoundary(cumulative, 150)).toBe(200)
  })

  it('末尾では末尾のまま', () => {
    expect(nextBoundary(cumulative, 200)).toBe(200)
  })

  it('空配列では 0', () => {
    expect(nextBoundary([], 0)).toBe(0)
  })
})

describe('markerAt（タートル位置の補間）', () => {
  it('距離 0 は最初の線分の始点・進行方向', () => {
    const m = markerAt(L_DATA, 0)
    expect(m.x).toBe(0)
    expect(m.y).toBe(0)
    expect(m.heading).toBeCloseTo(0) // 横方向（東）
  })

  it('線分の途中を補間する', () => {
    const m = markerAt(L_DATA, 50)
    expect(m.x).toBe(50)
    expect(m.y).toBe(0)
  })

  it('2 本目に入ると向きが変わる', () => {
    const m = markerAt(L_DATA, 150)
    expect(m.x).toBe(100)
    expect(m.y).toBe(50)
    expect(m.heading).toBeCloseTo(90) // 縦方向（北）
  })

  it('全描画後は最終状態の heading を使う', () => {
    const m = markerAt(L_DATA, 200)
    expect(m.x).toBe(100)
    expect(m.y).toBe(100)
    expect(m.heading).toBe(90)
  })
})

describe('drawGrid（方眼）', () => {
  it('中央（原点）を通る罫線が引かれる', () => {
    const { ctx, calls } = createMockContext()
    drawGrid(ctx, 400, 400, 50)
    const moveTos = calls.filter((c) => c.method === 'moveTo')
    // 縦の中央線 x=200 と横の中央線 y=200 が存在する
    expect(moveTos.some((c) => c.args[0] === 200 && c.args[1] === 0)).toBe(true)
    expect(moveTos.some((c) => c.args[0] === 0 && c.args[1] === 200)).toBe(true)
  })

  it('50px 間隔で罫線が並ぶ（400px なら縦9本+横9本+中央軸2本）', () => {
    const { ctx, calls } = createMockContext()
    drawGrid(ctx, 400, 400, 50)
    // 縦: -200..200 を 50 刻み = 9 本 / 横も 9 本 / 中央軸 2 本
    expect(calls.filter((c) => c.method === 'stroke')).toHaveLength(9 + 9 + 2)
  })

  it('view に応じて方眼がスクロールする（原点軸の位置がずれる）', () => {
    const { ctx, calls } = createMockContext()
    // 等倍でタートルが (50,0) にいる追従ビュー → 原点は画面中央より左へ
    drawGrid(ctx, 400, 400, 50, { scale: 1, cx: 50, cy: 0 })
    const moveTos = calls.filter((c) => c.method === 'moveTo')
    // 原点の縦軸は canvasX = 200 + (0 - 50) = 150
    expect(moveTos.some((c) => c.args[0] === 150 && c.args[1] === 0)).toBe(true)
  })
})

describe('computeView（Canvas への自動フィット）', () => {
  it('収まる描画は等倍・原点中心（標準 turtle と同じ）', () => {
    const view = computeView(L_SEGMENTS, 400, 400)
    expect(view).toEqual({ scale: 1, cx: 0, cy: 0 })
  })

  it('はみ出す描画は縮小して中央寄せ', () => {
    // 幅 1000 の線分は 400 Canvas に収まらないため縮小される
    const big: TurtleSegment[] = [
      { x1: -500, y1: 0, x2: 500, y2: 0, color: 'black', width: 1 },
    ]
    const view = computeView(big, 400, 400)
    expect(view.scale).toBeLessThan(1)
    expect(view.cx).toBe(0) // 中心は線分中央
    expect(view.cy).toBe(0)
    // (400 - 2*24) / 1000
    expect(view.scale).toBeCloseTo(352 / 1000)
  })

  it('オフセットした大きな描画は中心がずれる', () => {
    const big: TurtleSegment[] = [
      { x1: 0, y1: 0, x2: 1000, y2: 0, color: 'black', width: 1 },
    ]
    const view = computeView(big, 400, 400)
    expect(view.cx).toBe(500)
  })

  it('空配列は等倍', () => {
    expect(computeView([], 400, 400)).toEqual({ scale: 1, cx: 0, cy: 0 })
  })
})

describe('drawTurtleFrame（部分描画）', () => {
  const W = 400
  const H = 400

  it('途中距離では 1 本目のみ完全、2 本目は部分描画', () => {
    const { ctx, calls } = createMockContext()
    drawTurtleFrame(ctx, L_DATA, W, H, 150)
    // 1 本目フル + 2 本目部分 = stroke 2 回
    expect(calls.filter((c) => c.method === 'stroke')).toHaveLength(2)
    const lineTos = calls.filter((c) => c.method === 'lineTo')
    // 2 本目は (100,0)→(100,50) の途中まで。Canvas 座標 y=200-50=150
    expect(lineTos[1].args).toEqual([300, 150])
  })

  it('距離 0 では線を描かずマーカーのみ', () => {
    const { ctx, calls } = createMockContext()
    drawTurtleFrame(ctx, L_DATA, W, H, 0)
    expect(calls.some((c) => c.method === 'stroke')).toBe(false)
    expect(calls.some((c) => c.method === 'fill')).toBe(true)
  })
})
