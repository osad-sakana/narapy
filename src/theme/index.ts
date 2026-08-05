import { PALETTES, type Palette, type ResolvedTheme } from './palette'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'narapy-theme-v1'
const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

function isPreference(value: string | null): value is ThemePreference {
  return value !== null && (PREFERENCES as readonly string[]).includes(value)
}

export function getPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isPreference(raw) ? raw : 'system'
  } catch {
    return 'system'
  }
}

function savePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch { /* プライベートモード等で書けなくても表示は続行する */ }
}

function systemQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null
}

export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark'
  return preference
}

let current: ResolvedTheme = 'dark'
const listeners = new Set<(theme: ResolvedTheme, palette: Palette) => void>()

export function getResolvedTheme(): ResolvedTheme {
  return current
}

export function getPalette(): Palette {
  return PALETTES[current]
}

/** Monaco / Blockly など CSS 変数を解釈できない描画系へテーマ変更を伝える */
export function onThemeChange(listener: (theme: ResolvedTheme, palette: Palette) => void): void {
  listeners.add(listener)
}

// data-theme を付けるのは明示選択時のみ。システム追従では属性を外し、
// style.css 側の prefers-color-scheme メディアクエリに任せる（初回描画のちらつき防止）。
function apply(preference: ThemePreference, systemPrefersLight: boolean): void {
  const resolved = resolveTheme(preference, systemPrefersLight)
  const root = document.documentElement
  if (preference === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.dataset.theme = preference
  }
  if (resolved === current) return
  current = resolved
  for (const listener of listeners) listener(resolved, PALETTES[resolved])
}

const BTN_BASE = 'text-xs px-2 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0'
export const THEME_BTN_ACTIVE = `${BTN_BASE} bg-accent text-accent-ink`
export const THEME_BTN_INACTIVE = `${BTN_BASE} text-muted hover:text-ink hover:bg-hover`

const LABELS: Record<ThemePreference, string> = {
  system: 'システム',
  light: 'ライト',
  dark: 'ダーク',
}

/**
 * テーマの初期適用とヘッダーの切替UIの初期化。
 * 切替UIが無いページ（make-url など）でも呼べるよう、要素が無い場合は適用だけ行う。
 */
export function initTheme(): void {
  const query = systemQuery()
  let preference = getPreference()

  // 初回はリスナー通知なしで現在値を確定させる（リスナー登録前に呼ばれるため）
  current = resolveTheme(preference, query?.matches ?? false)
  apply(preference, query?.matches ?? false)

  query?.addEventListener('change', (event) => {
    apply(getPreference(), event.matches)
  })

  const container = document.getElementById('themeSwitcher')
  if (!container) return

  const buttons = PREFERENCES.map((key) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = LABELS[key]
    btn.title = `テーマ: ${LABELS[key]}`
    btn.addEventListener('click', () => {
      preference = key
      savePreference(key)
      apply(key, query?.matches ?? false)
      updateStyles()
    })
    container.appendChild(btn)
    return { key, btn }
  })

  function updateStyles(): void {
    for (const { key, btn } of buttons) {
      btn.className = key === preference ? THEME_BTN_ACTIVE : THEME_BTN_INACTIVE
    }
  }

  updateStyles()
}
