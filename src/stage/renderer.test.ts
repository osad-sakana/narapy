import { describe, it, expect, vi } from 'vitest'
import { toCanvasX, toCanvasY, arrowPoints, renderScene } from './renderer'
import { STAGE_WIDTH, STAGE_HEIGHT } from './types'
import type { StageScene, StageSprite } from './types'

function sprite(overrides: Partial<StageSprite> = {}): StageSprite {
  return {
    x: 0,
    y: 0,
    direction: 0,
    size: 100,
    color: '#ffffff',
    visible: true,
    ...overrides,
  }
}

describe('toCanvasX / toCanvasY', () => {
  it('原点はキャンバス中央へ変換される', () => {
    expect(toCanvasX(0)).toBe(STAGE_WIDTH / 2)
    expect(toCanvasY(0)).toBe(STAGE_HEIGHT / 2)
  })

  it('X は右方向が正、Y は上方向が正（Canvas は下向きなので反転）', () => {
    expect(toCanvasX(100)).toBe(STAGE_WIDTH / 2 + 100)
    expect(toCanvasY(100)).toBe(STAGE_HEIGHT / 2 - 100)
    expect(toCanvasY(-100)).toBe(STAGE_HEIGHT / 2 + 100)
  })
})

describe('arrowPoints', () => {
  it('direction=0 では尖端が中心より右（東）にある', () => {
    const [tip] = arrowPoints(sprite({ direction: 0 }))
    expect(tip.x).toBeGreaterThan(STAGE_WIDTH / 2)
    expect(tip.y).toBeCloseTo(STAGE_HEIGHT / 2, 5)
  })

  it('direction=90 では尖端が中心より上にある（Canvas Y は小さくなる）', () => {
    const [tip] = arrowPoints(sprite({ direction: 90 }))
    expect(tip.x).toBeCloseTo(STAGE_WIDTH / 2, 5)
    expect(tip.y).toBeLessThan(STAGE_HEIGHT / 2)
  })

  it('size を大きくすると尖端が中心から遠ざかる', () => {
    const [small] = arrowPoints(sprite({ size: 100 }))
    const [big] = arrowPoints(sprite({ size: 200 }))
    expect(big.x - STAGE_WIDTH / 2).toBeGreaterThan(small.x - STAGE_WIDTH / 2)
  })

  it('スプライト位置が頂点へ平行移動として反映される', () => {
    const [tip] = arrowPoints(sprite({ x: 50, y: 0, direction: 0 }))
    expect(tip.x).toBeGreaterThan(STAGE_WIDTH / 2 + 50)
  })

  it('3頂点を返す', () => {
    expect(arrowPoints(sprite())).toHaveLength(3)
  })
})

describe('renderScene', () => {
  function fakeCtx() {
    return {
      fillStyle: '',
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>
  }

  const scene = (sprites: StageSprite[]): StageScene => ({ background: '#000000', sprites })

  it('背景を1回塗りつぶす', () => {
    const ctx = fakeCtx()
    renderScene(ctx, scene([]))
    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  })

  it('可視スプライトは三角形パスとして塗られる', () => {
    const ctx = fakeCtx()
    renderScene(ctx, scene([sprite()]))
    expect(ctx.beginPath).toHaveBeenCalledTimes(1)
    expect(ctx.moveTo).toHaveBeenCalledTimes(1)
    expect(ctx.lineTo).toHaveBeenCalledTimes(2)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
  })

  it('不可視スプライトは描画されない', () => {
    const ctx = fakeCtx()
    renderScene(ctx, scene([sprite({ visible: false })]))
    expect(ctx.beginPath).not.toHaveBeenCalled()
  })
})
