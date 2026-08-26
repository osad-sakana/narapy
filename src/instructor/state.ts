// 講師モードのON/OFF状態の永続化。基準スナップショットはメモリのみで保持し、
// ここでは持たない（意図的な設計。リロードのたびに現在の内容が新しい基準に見えると
// 差分の意味がなくなるため）。

const STORAGE_KEY = 'narapy-instructor-v1'

export function getInstructorEnabled(): boolean {
  try {
    // 不正値（型不一致等）は必ずOFFへフォールバックする
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setInstructorEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch { /* ignore */ }
}
