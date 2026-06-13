import { describe, it, expect } from 'vitest'
import { turtleToCanvas, drawTurtleCommands, type DrawContext } from './turtleRenderer'
import type { TurtleCommands } from '../types'

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
