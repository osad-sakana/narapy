// ファイルエクスプローラーの幅（px）。ドラッグ・キーボードで変更でき、localStorage に保存する。
export const EXPLORER_WIDTH_DEFAULT = 176
export const EXPLORER_WIDTH_MIN = 128
export const EXPLORER_WIDTH_MAX = 480
export const EXPLORER_WIDTH_STEP = 16

const STORAGE_KEY = 'narapy-explorer-width-v1'

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return EXPLORER_WIDTH_DEFAULT
  return Math.min(EXPLORER_WIDTH_MAX, Math.max(EXPLORER_WIDTH_MIN, Math.round(width)))
}

export function parseStoredWidth(raw: string | null): number {
  if (raw === null || raw.trim() === '') return EXPLORER_WIDTH_DEFAULT
  return clampWidth(Number(raw))
}

// localStorage は無効化・容量超過で例外になり得るため、読み書きとも失敗は黙って既定値に倒す
export function loadWidth(): number {
  try {
    return parseStoredWidth(localStorage.getItem(STORAGE_KEY))
  } catch {
    return EXPLORER_WIDTH_DEFAULT
  }
}

export function saveWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampWidth(width)))
  } catch {
    // 保存できなくても今回の表示には影響しない
  }
}
