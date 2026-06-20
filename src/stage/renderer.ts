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

// コスチューム画像とその反転設定。name で引ける形で renderScene に渡す。
export interface CostumeView {
  image: CanvasImageSource
  flipH: boolean
  flipV: boolean
}

export type CostumeLookup = (name: string) => CostumeView | undefined

// size=100 のときの画像の基準サイズ（長辺をこの px に正規化してから size で拡縮）。
const COSTUME_BASE_PX = 96

function imageSize(image: CanvasImageSource): { w: number; h: number } {
  // ImageBitmap / HTMLImageElement / HTMLCanvasElement はいずれも width/height を持つ
  const src = image as { width: number; height: number }
  return { w: src.width, h: src.height }
}

function drawArrow(ctx: CanvasRenderingContext2D, sprite: StageSprite): void {
  const [tip, w1, w2] = arrowPoints(sprite)
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(w1.x, w1.y)
  ctx.lineTo(w2.x, w2.y)
  ctx.closePath()
  ctx.fillStyle = sprite.color
  ctx.fill()
}

function drawCostume(
  ctx: CanvasRenderingContext2D,
  sprite: StageSprite,
  view: CostumeView,
): void {
  const { w, h } = imageSize(view.image)
  if (w === 0 || h === 0) return
  const base = COSTUME_BASE_PX / Math.max(w, h)
  const scale = base * (sprite.size / 100)
  const dw = w * scale
  const dh = h * scale

  ctx.save()
  ctx.translate(toCanvasX(sprite.x), toCanvasY(sprite.y))
  // direction はステージ座標系（反時計回りが正）。Canvas は Y 下向きなので符号反転。
  ctx.rotate((-sprite.direction * Math.PI) / 180)
  ctx.scale(view.flipH ? -1 : 1, view.flipV ? -1 : 1)
  ctx.drawImage(view.image, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

// シーン全体を Canvas 2D コンテキストへ描画する。
// costumes が与えられ、スプライト名に画像があればそれを、無ければ矢印を描く。
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: StageScene,
  costumes?: CostumeLookup,
): void {
  ctx.fillStyle = scene.background
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  for (const sprite of scene.sprites) {
    if (!sprite.visible) continue
    const view = costumes?.(sprite.name)
    if (view) {
      drawCostume(ctx, sprite, view)
    } else {
      drawArrow(ctx, sprite)
    }
  }
}
