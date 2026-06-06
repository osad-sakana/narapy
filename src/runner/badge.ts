import { showConversionErrorModal } from './conversionErrorModal'

export type BadgeState = 'neutral' | 'success' | 'error' | 'warn'

const BADGE_CLASSES: Record<BadgeState, string> = {
  success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  error:   'bg-red-500/20 text-red-300 border border-red-500/30',
  warn:    'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  neutral: 'bg-slate-700 text-slate-400',
}

export function setBadge(text: string, state: BadgeState): void {
  const badge = document.getElementById('validationBadge') as HTMLSpanElement
  badge.textContent = text
  badge.className = `text-xs px-2 py-0.5 rounded-full transition-all ${BADGE_CLASSES[state]}`
  badge.onclick = null
  badge.style.cursor = ''
}

export function setBadgeWithDetail(text: string, state: BadgeState, detail: string): void {
  const badge = document.getElementById('validationBadge') as HTMLSpanElement
  badge.textContent = text
  badge.className = `text-xs px-2 py-0.5 rounded-full transition-all cursor-pointer underline decoration-dotted hover:opacity-75 ${BADGE_CLASSES[state]}`
  badge.onclick = () => showConversionErrorModal(detail)
}
