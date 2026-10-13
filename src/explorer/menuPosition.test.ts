import { describe, it, expect } from 'vitest'
import { clampMenuPosition } from './menuPosition'

const viewport = { width: 1000, height: 600 }
const menu = { width: 200, height: 120 }

describe('clampMenuPosition', () => {
  it('収まる場合は指定位置のまま', () => {
    expect(clampMenuPosition({ x: 100, y: 100 }, menu, viewport)).toEqual({ left: 100, top: 100 })
  })

  it('右端からはみ出す場合は左へ寄せる', () => {
    expect(clampMenuPosition({ x: 950, y: 100 }, menu, viewport)).toEqual({ left: 796, top: 100 })
  })

  it('下端からはみ出す場合は上へ寄せる', () => {
    expect(clampMenuPosition({ x: 100, y: 580 }, menu, viewport)).toEqual({ left: 100, top: 476 })
  })

  it('負の座標は余白の位置に収める', () => {
    expect(clampMenuPosition({ x: -50, y: -50 }, menu, viewport)).toEqual({ left: 4, top: 4 })
  })

  it('ビューポートより大きいメニューでも余白位置にする', () => {
    expect(clampMenuPosition({ x: 10, y: 10 }, { width: 2000, height: 2000 }, viewport)).toEqual({ left: 4, top: 4 })
  })
})
