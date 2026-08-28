// 講師用フォントサイズの永続化。通常フォントサイズ（src/editor/fontSize.ts）とは
// 別のキーで独立して記憶する。講義用に大きめの範囲・ステップを持つ。

const STORAGE_KEY = 'narapy-instructor-font-size-v1'

export const INSTRUCTOR_FONT_DEFAULT = 20
export const INSTRUCTOR_FONT_MIN = 10
export const INSTRUCTOR_FONT_MAX = 32
export const INSTRUCTOR_FONT_STEP = 2

function clamp(size: number): number {
  return Math.min(INSTRUCTOR_FONT_MAX, Math.max(INSTRUCTOR_FONT_MIN, size))
}

export function getInstructorFontSize(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === null) return INSTRUCTOR_FONT_DEFAULT
    const n = Number(v)
    return Number.isFinite(n) ? clamp(n) : INSTRUCTOR_FONT_DEFAULT
  } catch {
    return INSTRUCTOR_FONT_DEFAULT
  }
}

export function setInstructorFontSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clamp(size)))
  } catch { /* ignore */ }
}
