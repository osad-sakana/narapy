const STORAGE_KEY = 'narapy-font-size-v1'
const DEFAULT = 13
const MIN = 10
const MAX = 24

export function getFontSize(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === null) return DEFAULT
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(MAX, Math.max(MIN, n)) : DEFAULT
  } catch {
    return DEFAULT
  }
}

function saveFontSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(size))
  } catch { /* ignore */ }
}

export function initFontSizeControls(onSizeChange: (size: number) => void): void {
  const decreaseBtn = document.getElementById('fontDecrease') as HTMLButtonElement | null
  const increaseBtn = document.getElementById('fontIncrease') as HTMLButtonElement | null
  const sizeLabel   = document.getElementById('fontSizeLabel') as HTMLElement | null

  function applySize(size: number): void {
    onSizeChange(size)
    if (sizeLabel) sizeLabel.textContent = String(size)
    saveFontSize(size)
  }

  applySize(getFontSize())

  decreaseBtn?.addEventListener('click', () => {
    applySize(Math.max(MIN, getFontSize() - 1))
  })

  increaseBtn?.addEventListener('click', () => {
    applySize(Math.min(MAX, getFontSize() + 1))
  })
}
