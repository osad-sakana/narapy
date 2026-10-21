export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

const MARGIN = 4

// メニューをビューポート内に収める。右・下にはみ出す場合は寄せ、
// 収まらないほど大きい場合や負の座標は余白の位置に置く。
export function clampMenuPosition(
  anchor: Point,
  menu: Size,
  viewport: Size,
): { left: number; top: number } {
  const maxLeft = viewport.width - menu.width - MARGIN
  const maxTop = viewport.height - menu.height - MARGIN
  return {
    left: Math.max(MARGIN, Math.min(anchor.x, maxLeft)),
    top: Math.max(MARGIN, Math.min(anchor.y, maxTop)),
  }
}
