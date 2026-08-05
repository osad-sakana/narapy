const LICENSES = [
  {
    name: 'Google Blockly',
    version: '12',
    license: 'Apache-2.0',
    copyright: 'Copyright 2012 Google LLC',
    url: 'https://github.com/google/blockly',
  },
  {
    name: 'Monaco Editor',
    version: '0.55',
    license: 'MIT',
    copyright: 'Copyright Microsoft Corporation',
    url: 'https://github.com/microsoft/monaco-editor',
  },
  {
    name: 'Pyodide',
    version: '0.27.0',
    license: 'MPL-2.0',
    copyright: 'Copyright Pyodide contributors',
    url: 'https://github.com/pyodide/pyodide',
  },
  {
    name: 'jedi',
    version: '0.19.1',
    license: 'MIT',
    copyright: 'Copyright 2013 David Halter and others',
    url: 'https://github.com/davidhalter/jedi',
  },
  {
    name: 'parso',
    version: '0.8.4',
    license: 'MIT',
    copyright: 'Copyright 2013 David Halter and others',
    url: 'https://github.com/davidhalter/parso',
  },
  {
    name: 'split.js',
    version: '1.6',
    license: 'MIT',
    copyright: 'Copyright Nathan Cahill',
    url: 'https://github.com/nathancahill/split',
  },
  {
    name: 'Tailwind CSS',
    version: '4',
    license: 'MIT',
    copyright: 'Copyright Tailwind Labs Inc.',
    url: 'https://github.com/tailwindlabs/tailwindcss',
  },
  {
    name: 'BIZ UDPGothic / 0xProto',
    version: '',
    license: 'SIL OFL 1.1',
    copyright: 'Respective authors',
    url: 'https://fonts.google.com',
  },
] as const

export function initAbout(): void {
  const btn = document.getElementById('aboutBtn')
  if (!btn) return
  btn.addEventListener('click', showAboutModal)
}

function showAboutModal(): void {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl max-w-lg w-full flex flex-col max-h-[80vh] overflow-hidden'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between px-5 py-3 border-b border-line shrink-0'

  const title = document.createElement('span')
  title.className = 'text-sm font-bold text-ink'
  title.textContent = 'オープンソースライセンス'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-muted hover:text-ink transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-hover cursor-pointer'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', '閉じる')

  header.appendChild(title)
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'overflow-y-auto p-5 space-y-3'

  for (const pkg of LICENSES) {
    const row = document.createElement('div')
    row.className = 'border border-line rounded-lg px-4 py-3 bg-canvas'

    const topRow = document.createElement('div')
    topRow.className = 'flex items-baseline justify-between gap-2'

    const nameEl = document.createElement('span')
    nameEl.className = 'text-sm font-semibold text-ink'
    nameEl.textContent = pkg.name + (pkg.version ? ` v${pkg.version}` : '')

    const licenseEl = document.createElement('span')
    licenseEl.className = 'text-xs px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30 shrink-0'
    licenseEl.textContent = pkg.license

    topRow.appendChild(nameEl)
    topRow.appendChild(licenseEl)

    const copy = document.createElement('p')
    copy.className = 'text-xs text-muted mt-1'
    copy.textContent = pkg.copyright

    row.appendChild(topRow)
    row.appendChild(copy)
    body.appendChild(row)
  }

  // Narapy 自身の著作権表示
  const selfNote = document.createElement('p')
  selfNote.className = 'text-xs text-muted pt-1 text-center'
  selfNote.textContent = `Narapy — Python Learning Environment`
  body.appendChild(selfNote)

  card.appendChild(header)
  card.appendChild(body)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  const close = (): void => {
    backdrop.remove()
    document.removeEventListener('keydown', handleKey)
  }

  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }

  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', handleKey)
}
