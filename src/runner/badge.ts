import { showConversionErrorModal } from './conversionErrorModal'

export type BadgeState = 'neutral' | 'success' | 'error' | 'warn'

const BADGE_CLASSES: Record<BadgeState, string> = {
  success: 'bg-success/15 text-success border border-success/30',
  error:   'bg-danger/15 text-danger border border-danger/30',
  warn:    'bg-warn/15 text-warn border border-warn/30',
  neutral: 'bg-hover text-muted border border-transparent',
}

export function setBadge(text: string, state: BadgeState): void {
  const badge = document.getElementById('validationBadge') as HTMLSpanElement
  badge.textContent = text
  badge.className = `text-xs px-2 py-0.5 rounded-md transition-all ${BADGE_CLASSES[state]}`
  badge.onclick = null
  badge.style.cursor = ''
}

export function setBadgeWithDetail(text: string, state: BadgeState, detail: string): void {
  const badge = document.getElementById('validationBadge') as HTMLSpanElement
  badge.textContent = text
  badge.className = `text-xs px-2 py-0.5 rounded-md transition-all cursor-pointer underline decoration-dotted hover:opacity-75 ${BADGE_CLASSES[state]}`
  badge.onclick = () => showConversionErrorModal(detail)
}
