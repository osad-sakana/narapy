// フォントサイズの永続化プロファイル。通常サイズ（このファイル）と講師用サイズ
// （src/instructor/fontSize.ts）を同じ ± ボタンで切り替えて操作できるようにする。
export interface FontSizeProfile {
  get: () => number
  set: (size: number) => void
  min: number
  max: number
  step: number
}

const STORAGE_KEY = 'narapy-font-size-v1'
const DEFAULT = 13
const MIN = 10
const MAX = 24
const STEP = 1

function clamp(size: number): number {
  return Math.min(MAX, Math.max(MIN, size))
}

export function getFontSize(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === null) return DEFAULT
    const n = Number(v)
    return Number.isFinite(n) ? clamp(n) : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function setFontSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clamp(size)))
  } catch { /* ignore */ }
}

export const normalFontProfile: FontSizeProfile = {
  get: getFontSize,
  set: setFontSize,
  min: MIN,
  max: MAX,
  step: STEP,
}

// getActiveProfile省略時は通常プロファイル固定（make-url.html はこの既定動作のまま使う）。
// 本体アプリ(main.ts)は講師モードON中は講師用プロファイルを返すgetterを渡し、
// 同じボタンで「現在アクティブな方」を増減できるようにする。
export function initFontSizeControls(
  onSizeChange: (size: number) => void,
  getActiveProfile: () => FontSizeProfile = () => normalFontProfile,
): { refresh: () => void } {
  const decreaseBtn = document.getElementById('fontDecrease') as HTMLButtonElement | null
  const increaseBtn = document.getElementById('fontIncrease') as HTMLButtonElement | null
  const sizeLabel   = document.getElementById('fontSizeLabel') as HTMLElement | null

  function applyCurrent(): void {
    const size = getActiveProfile().get()
    onSizeChange(size)
    if (sizeLabel) sizeLabel.textContent = String(size)
  }

  applyCurrent()

  decreaseBtn?.addEventListener('click', () => {
    const profile = getActiveProfile()
    profile.set(profile.get() - profile.step)
    applyCurrent()
  })

  increaseBtn?.addEventListener('click', () => {
    const profile = getActiveProfile()
    profile.set(profile.get() + profile.step)
    applyCurrent()
  })

  return { refresh: applyCurrent }
}
