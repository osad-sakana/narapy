import { LICENSES, type LicenseEntry, type LicenseLink } from './licenses'

export function initAbout(): void {
  const btn = document.getElementById('aboutBtn')
  if (!btn) return
  btn.addEventListener('click', showAboutModal)
}

function createLink(url: string, text: string, className: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = url
  a.textContent = text
  a.className = className
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  return a
}

function createLicenseBadge(license: LicenseLink): HTMLAnchorElement {
  return createLink(
    license.url,
    license.label,
    'text-xs px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors',
  )
}

function createLicenseRow(entry: LicenseEntry): HTMLElement {
  const row = document.createElement('div')
  row.className = 'border border-line rounded-lg px-4 py-3 bg-canvas'
  row.dataset.license = entry.name

  const topRow = document.createElement('div')
  topRow.className = 'flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1'

  const label = entry.name + (entry.version ? ` v${entry.version}` : '')
  const nameEl = createLink(entry.url, label, 'min-w-0 break-words text-sm font-semibold text-ink hover:underline')

  const badges = document.createElement('div')
  badges.className = 'flex flex-wrap justify-end gap-1'
  for (const license of entry.licenses) badges.appendChild(createLicenseBadge(license))

  topRow.appendChild(nameEl)
  topRow.appendChild(badges)
  row.appendChild(topRow)

  const copy = document.createElement('p')
  copy.className = 'text-xs text-muted mt-1'
  copy.textContent = entry.copyright
  row.appendChild(copy)

  if (entry.note) {
    const note = document.createElement('p')
    note.className = 'text-xs text-muted mt-0.5'
    note.textContent = entry.note
    row.appendChild(note)
  }
  return row
}

function createHeader(onClose: () => void): HTMLElement {
  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-5 py-3 border-b border-line shrink-0'

  const title = document.createElement('span')
  title.id = 'aboutTitle'
  title.className = 'text-sm font-bold text-ink'
  title.textContent = 'オープンソースライセンス'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-muted hover:text-ink transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-hover cursor-pointer'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')
  closeBtn.addEventListener('click', onClose)

  header.appendChild(title)
  header.appendChild(closeBtn)
  return header
}

function createBody(): HTMLElement {
  const body = document.createElement('div')
  body.className = 'overflow-y-auto p-5 space-y-3'

  const intro = document.createElement('p')
  intro.className = 'text-xs text-muted'
  intro.textContent = 'Narapy は次のオープンソースソフトウェアなどを利用しています。名前とライセンス名はそれぞれのページへのリンクです。'
  body.appendChild(intro)

  for (const entry of LICENSES) body.appendChild(createLicenseRow(entry))

  // Narapy 自身の著作権表示
  const selfNote = document.createElement('p')
  selfNote.className = 'text-xs text-muted pt-1 text-center'
  selfNote.textContent = 'Narapy — Python Learning Environment'
  body.appendChild(selfNote)
  return body
}

function showAboutModal(): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl max-w-lg w-full flex flex-col max-h-[80vh] overflow-hidden'
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')
  card.setAttribute('aria-labelledby', 'aboutTitle')

  const close = (): void => {
    backdrop.remove()
    document.removeEventListener('keydown', handleKey)
  }

  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }

  card.appendChild(createHeader(close))
  card.appendChild(createBody())
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', handleKey)
}
