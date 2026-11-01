import { setIconLabel } from '../ui/icon'
import { buildCodeLink, buildProjectLink, currentBaseUrl, MAX_SHARE_URL_LENGTH, pickCodeTarget, type ShareLinkResult, type ShareState } from './shareLinks'

export interface ShareModalDeps {
  // エディタの未保存内容を反映した現在の状態を返す
  getState: () => Promise<ShareState> | ShareState
  isExercise: () => boolean
  copyText?: (text: string) => Promise<void>
}

const COPIED_RESET_MS = 2000

function tooLongMessage(length: number): string {
  return `リンクが長すぎます(${length.toLocaleString()} 文字 / 上限 ${MAX_SHARE_URL_LENGTH.toLocaleString()} 文字)。画像などのファイルを減らすか、.narapy ファイルで共有してください。`
}

function describeFailure(result: Extract<ShareLinkResult, { ok: false }>): string {
  return result.reason === 'tooLong' ? tooLongMessage(result.length) : '共有できるテキストファイルがありません。'
}

function createRow(label: string, note: string): { row: HTMLElement; button: HTMLButtonElement; message: HTMLElement } {
  const row = document.createElement('div')
  row.className = 'flex flex-col gap-1'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'h-9 px-3 rounded text-sm font-bold bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  setIconLabel(button, 'copy', label)
  const noteEl = document.createElement('p')
  noteEl.className = 'text-xs text-muted'
  noteEl.textContent = note
  const message = document.createElement('p')
  message.className = 'text-xs text-danger'
  message.setAttribute('role', 'status')
  row.append(button, noteEl, message)
  return { row, button, message }
}

// 「共有リンクを作る」モーダル。表示・フォーカス・Escape は sharedLinkGuard の確認ダイアログに揃える
export async function openShareModal(deps: ShareModalDeps): Promise<void> {
  if (document.getElementById('shareLinkDialog')) return
  const state = await deps.getState()
  const base = currentBaseUrl()
  const copyText = deps.copyText ?? ((text: string) => navigator.clipboard.writeText(text))
  const previouslyFocused = document.activeElement as HTMLElement | null

  const backdrop = document.createElement('div')
  backdrop.id = 'shareLinkDialog'
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.setAttribute('aria-labelledby', 'shareLinkTitle')

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl max-w-md w-full flex flex-col gap-4 p-5'
  const title = document.createElement('h2')
  title.id = 'shareLinkTitle'
  title.className = 'text-ink text-base font-bold flex items-center gap-2'
  setIconLabel(title, 'share-nodes', '共有リンクを作る')

  const target = pickCodeTarget(state)
  const code = createRow(`${target?.path ?? 'main.py'} を共有`, '1ファイルだけのリンク。開いた人には新しいプロジェクトとして追加されます。')
  const project = createRow('現在のプロジェクト全体を共有', 'すべてのファイルを含むリンク。開いた人には新しいプロジェクトとして追加されます。')
  const rows: Array<{ button: HTMLButtonElement; message: HTMLElement; label: string; build: () => ShareLinkResult }> = [
    { ...code, label: `${target?.path ?? 'main.py'} を共有`, build: () => buildCodeLink(base, state) },
    { ...project, label: '現在のプロジェクト全体を共有', build: () => buildProjectLink(base, state) },
  ]
  const notes: HTMLElement[] = []
  if (deps.isExercise()) {
    const note = document.createElement('p')
    note.className = 'text-xs text-muted'
    note.textContent = '演習の問題文・採点情報はリンクに含まれず、通常のプロジェクトとして共有されます。演習として配布するには /make-exercise を使ってください。'
    notes.push(note)
  }

  const timers = new Set<ReturnType<typeof setTimeout>>()
  for (const r of rows) {
    const result = r.build()
    if (!result.ok) {
      r.button.disabled = true
      r.message.textContent = describeFailure(result)
      continue
    }
    r.button.addEventListener('click', async () => {
      try {
        await copyText(result.url)
        setIconLabel(r.button, 'check', 'コピーしました')
        r.message.textContent = ''
        const timer = setTimeout(() => { timers.delete(timer); setIconLabel(r.button, 'copy', r.label) }, COPIED_RESET_MS)
        timers.add(timer)
      } catch {
        r.message.textContent = 'クリップボードにコピーできませんでした。'
      }
    })
  }

  const actions = document.createElement('div')
  actions.className = 'flex justify-end'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'px-4 h-8 rounded text-sm text-muted hover:text-ink hover:bg-hover transition-colors'
  closeBtn.textContent = '閉じる'
  actions.appendChild(closeBtn)

  card.append(title, code.row, project.row, ...notes, actions)
  backdrop.appendChild(card)

  const close = (): void => {
    document.removeEventListener('keydown', onKey, true)
    for (const t of timers) clearTimeout(t)
    backdrop.remove()
    previouslyFocused?.focus?.()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close()
  }
  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close() })
  document.addEventListener('keydown', onKey, true)
  document.body.appendChild(backdrop)
  const firstEnabled = rows.find(r => !r.button.disabled)?.button ?? closeBtn
  firstEnabled.focus()
}
