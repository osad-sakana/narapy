// シーン → Canvas 描画。座標変換とポリゴン計算は純関数として切り出し、単体テスト可能にする。
// ステージ座標（中央原点・Y軸上向き）を Canvas 座標（左上原点・Y軸下向き）へ変換する。

import { STAGE_WIDTH, STAGE_HEIGHT } from './types'
import type { StageScene, StageSprite } from './types'

export interface Point {
  readonly x: number
  readonly y: number
}

// ステージ座標 → Canvas 座標。
export function toCanvasX(x: number): number {
  return STAGE_WIDTH / 2 + x
}

export function toCanvasY(y: number): number {
  return STAGE_HEIGHT / 2 - y
}

// PoC スプライト（矢印）の基準寸法。size=100 のときの値。
const ARROW_LENGTH = 16
const ARROW_WING = 11
const ARROW_BACK_RATIO = 0.6

// スプライトを表す矢印ポリゴンの3頂点を Canvas 座標で返す。
// 向き(direction)へ尖端が向く。ローカル座標で組み立ててから回転・平行移動する。
export function arrowPoints(sprite: StageSprite): readonly [Point, Point, Point] {
  const scale = sprite.size / 100
  const length = ARROW_LENGTH * scale
  const wing = ARROW_WING * scale
  const back = -length * ARROW_BACK_RATIO

  // ローカル座標（direction=0 で +x=東を向く）
  const local: readonly Point[] = [
    { x: length, y: 0 }, // 尖端
    { x: back, y: wing }, // 後方の片翼
    { x: back, y: -wing }, // 後方のもう片翼
  ]

  const rad = (sprite.direction * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const toWorld = (p: Point): Point => ({
    // ステージ座標系（Y軸上向き）での回転（反時計回りが正）
    x: sprite.x + (p.x * cos - p.y * sin),
    y: sprite.y + (p.x * sin + p.y * cos),
  })

  const [tip, w1, w2] = local.map(toWorld)
  const toCanvas = (p: Point): Point => ({ x: toCanvasX(p.x), y: toCanvasY(p.y) })

  return [toCanvas(tip), toCanvas(w1), toCanvas(w2)]
}

// シーン全体を Canvas 2D コンテキストへ描画する。
export function renderScene(ctx: CanvasRenderingContext2D, scene: StageScene): void {
  ctx.fillStyle = scene.background
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  for (const sprite of scene.sprites) {
    if (!sprite.visible) continue
    const [tip, w1, w2] = arrowPoints(sprite)
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(w1.x, w1.y)
    ctx.lineTo(w2.x, w2.y)
    ctx.closePath()
    ctx.fillStyle = sprite.color
    ctx.fill()
  }
}
