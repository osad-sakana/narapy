export interface InputModalHandle {
  dismiss: () => void
}

let nextModalId = 0

// Python の input() に対応するアプリ内モーダル。
// window.prompt() は連続表示するとブラウザが「これ以降のダイアログをブロック」を
// 有効化することがあり、有効化された瞬間から null が即座に返り続けて
// 2回目以降の input() が常に空文字になってしまう。そのため window.prompt には頼らない。
//
// onOpen で dismiss 関数を受け取れる。停止操作でワーカーごと再生成する際に、
// 開いたままのモーダルを外部から閉じるために使う。
export function showInputModal(
  prompt: string,
  onOpen?: (handle: InputModalHandle) => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const promptId = `inputModalPrompt-${nextModalId++}`

    const backdrop = document.createElement('div')
    backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

    const card = document.createElement('div')
    card.className = 'bg-slate-800 rounded-xl shadow-2xl overflow-hidden max-w-md w-full flex flex-col'
    card.setAttribute('role', 'dialog')
    card.setAttribute('aria-modal', 'true')
    card.setAttribute('aria-labelledby', promptId)

    const header = document.createElement('div')
    header.className = 'flex items-center justify-between px-4 py-2 bg-slate-700 flex-shrink-0'

    const titleEl = document.createElement('span')
    titleEl.className = 'text-slate-200 text-sm font-medium'
    titleEl.textContent = '⌨ input()'

    const body = document.createElement('div')
    body.className = 'p-4 flex flex-col gap-3'

    const promptEl = document.createElement('label')
    promptEl.id = promptId
    promptEl.htmlFor = `${promptId}-input`
    promptEl.className = 'text-slate-300 text-sm whitespace-pre-wrap break-all'
    promptEl.textContent = prompt || 'input()'

    const input = document.createElement('input')
    input.id = `${promptId}-input`
    input.type = 'text'
    input.className = 'w-full px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm border border-slate-600 focus:border-violet-400 focus:outline-none'

    const actions = document.createElement('div')
    actions.className = 'flex items-center justify-end gap-2'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-600 transition-colors cursor-pointer'
    cancelBtn.textContent = 'キャンセル'

    const submitBtn = document.createElement('button')
    submitBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-bold bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-colors cursor-pointer'
    submitBtn.textContent = '送信'

    actions.appendChild(cancelBtn)
    actions.appendChild(submitBtn)
    body.appendChild(promptEl)
    body.appendChild(input)
    body.appendChild(actions)
    header.appendChild(titleEl)
    card.appendChild(header)
    card.appendChild(body)
    backdrop.appendChild(card)
    document.body.appendChild(backdrop)

    let closed = false
    const close = (value: string | null): void => {
      if (closed) return
      closed = true
      backdrop.remove()
      document.removeEventListener('keydown', handleEscape)
      // Enter/Escape のキーイベント処理中に同期でフォーカスを移すと、ブラウザが
      // 「Enterキーを押した時点でフォーカスされているボタン」への既定動作を
      // 移動後の要素に対して発火させてしまう（実行ボタンの意図しない誤クリック）。
      // イベント処理が完全に終わった後のタスクまでフォーカス復元を遅らせる。
      setTimeout(() => previouslyFocused?.focus(), 0)
      resolve(value)
    }

    // Escape はフォーカス位置に関わらずキャンセルできるよう document で拾う。
    // Enter は input 自身にだけ紐付け、IME変換確定やボタンフォーカス中の誤送信を避ける。
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(null)
    }

    const handleInputKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.isComposing) return
      close(input.value)
    }

    submitBtn.addEventListener('click', () => close(input.value))
    cancelBtn.addEventListener('click', () => close(null))
    input.addEventListener('keydown', handleInputKey)
    document.addEventListener('keydown', handleEscape)

    onOpen?.({ dismiss: () => close(null) })
    input.focus()
  })
}
