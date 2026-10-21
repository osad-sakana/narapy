import type { UrlLoadResult } from '../urlload/loadFromUrl'

type SharedSource = UrlLoadResult['source']

// 共有リンク(#code= / #project= / ?project=<URL>)から読み込んだプロジェクトか、
// その上でユーザーが pygame の実行を許可済みか。ページ読み込み中だけ持つ(永続化しない)。
let state: { source: SharedSource; approved: boolean } | null = null

export function markLoadedFromSharedLink(source: SharedSource): void {
  state = { source, approved: false }
}

// 共有リンク以外の経路(.narapy を開く・新規作成)でプロジェクトが置き換わったとき
export function clearSharedLinkMark(): void {
  state = null
}

export function isFromSharedLink(): boolean {
  return state !== null
}

function buildDialog(onChoice: (ok: boolean) => void): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.setAttribute('aria-labelledby', 'sharedLinkGuardTitle')

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl max-w-md w-full flex flex-col gap-3 p-5'

  const title = document.createElement('h2')
  title.id = 'sharedLinkGuardTitle'
  title.className = 'text-ink text-base font-bold'
  title.textContent = '⚠️ 共有リンクのコードを実行しますか？'

  const body = document.createElement('div')
  body.className = 'text-sm text-ink flex flex-col gap-2'
  const p1 = document.createElement('p')
  p1.textContent = 'このコードは共有リンクから読み込まれたもので、作成者はあなたではありません。'
  const p2 = document.createElement('p')
  p2.textContent =
    'pygame は通常の実行と違い、このページ本体の中で動くため、コードがこのページの画面や保存データに触れる可能性があります。送り主を信頼できる場合だけ実行してください。'
  body.append(p1, p2)

  const actions = document.createElement('div')
  actions.className = 'flex justify-end gap-2 mt-1'
  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'px-4 h-8 rounded text-sm text-muted hover:text-ink hover:bg-hover transition-colors'
  cancelBtn.textContent = 'キャンセル'
  const okBtn = document.createElement('button')
  okBtn.type = 'button'
  okBtn.className = 'px-4 h-8 rounded text-sm font-bold bg-danger text-white border border-danger hover:bg-white hover:text-danger transition-colors'
  okBtn.textContent = '実行する'

  cancelBtn.addEventListener('click', () => onChoice(false))
  okBtn.addEventListener('click', () => onChoice(true))
  actions.append(cancelBtn, okBtn)
  card.append(title, body, actions)
  backdrop.appendChild(card)
  return backdrop
}

// pygame を実行してよいか確認する。共有リンク由来でなければ、または許可済みなら即 true。
// 既定フォーカスは先頭の「キャンセル」に置き、Enter 連打で実行されないようにする。
export function confirmPygameRun(): Promise<boolean> {
  const current = state
  if (!current || current.approved) return Promise.resolve(true)

  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    let settled = false

    const finish = (ok: boolean): void => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', onKey, true)
      backdrop.remove()
      // 確認中に別の共有リンクへ置き換わっていたら、古い許可を新しい状態へ持ち越さない
      if (ok && state === current) state = { ...current, approved: true }
      previouslyFocused?.focus?.()
      resolve(ok)
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      finish(false)
    }

    const backdrop = buildDialog(finish)
    document.addEventListener('keydown', onKey, true)
    document.body.appendChild(backdrop)
    backdrop.querySelector<HTMLButtonElement>('button')?.focus()
  })
}
