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
// onStop を渡すと、モーダル内に実行停止ボタンを表示する（input() 待ちの間は
// バックドロップがツールバーの停止ボタンを覆ってしまうため、無限ループで
// input() を繰り返すコードを止める手段をモーダル内にも用意する）。
export function showInputModal(
  prompt: string,
  onOpen?: (handle: InputModalHandle) => void,
  onStop?: () => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const promptId = `inputModalPrompt-${nextModalId++}`

    const backdrop = document.createElement('div')
    backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'

    const card = document.createElement('div')
    card.className = 'bg-panel border border-line rounded-xl shadow-2xl overflow-hidden max-w-md w-full flex flex-col'
    card.setAttribute('role', 'dialog')
    card.setAttribute('aria-modal', 'true')
    card.setAttribute('aria-labelledby', promptId)

    const header = document.createElement('div')
    header.className = 'flex items-center justify-between px-4 py-2 bg-panel border-b border-line flex-shrink-0'

    const titleEl = document.createElement('span')
    titleEl.className = 'text-ink text-sm font-medium'
    titleEl.textContent = '⌨ input()'

    const body = document.createElement('div')
    body.className = 'p-4 flex flex-col gap-3'

    const promptEl = document.createElement('label')
    promptEl.id = promptId
    promptEl.htmlFor = `${promptId}-input`
    promptEl.className = 'text-code text-sm whitespace-pre-wrap break-all'
    promptEl.textContent = prompt || 'input()'

    const input = document.createElement('input')
    input.id = `${promptId}-input`
    input.type = 'text'
    input.className = 'w-full px-3 py-1.5 rounded-lg bg-editor text-ink text-sm border border-line focus:border-accent focus:outline-none'

    const actions = document.createElement('div')
    actions.className = 'flex items-center justify-between gap-2'

    const stopBtn = document.createElement('button')
    stopBtn.className = 'px-3 py-1.5 rounded-lg text-sm text-danger hover:opacity-80 hover:bg-danger/15 transition-colors cursor-pointer'
    stopBtn.textContent = '■ 実行を停止'

    const rightActions = document.createElement('div')
    rightActions.className = 'flex items-center gap-2'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer'
    cancelBtn.textContent = 'キャンセル'

    const submitBtn = document.createElement('button')
    submitBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-bold bg-accent text-accent-ink border border-accent hover:bg-accent-ink hover:text-accent transition-colors cursor-pointer'
    submitBtn.textContent = '送信'

    rightActions.appendChild(cancelBtn)
    rightActions.appendChild(submitBtn)
    if (onStop) actions.appendChild(stopBtn)
    actions.appendChild(rightActions)
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
      previouslyFocused?.focus()
      resolve(value)
    }

    // Escape はフォーカス位置に関わらずキャンセルできるよう document で拾う。
    // Enter は input 自身にだけ紐付け、IME変換確定やボタンフォーカス中の誤送信を避ける。
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(null)
    }

    const handleInputKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.isComposing) return
      // 既定動作（Enter押下時にフォーカスされているボタンをクリックする挙動）を
      // 止めておかないと、close() 内でフォーカスを戻した瞬間にその既定動作が
      // 移動後のボタン（実行/停止ボタンなど）に対して発火してしまう。
      e.preventDefault()
      close(input.value)
    }

    submitBtn.addEventListener('click', () => close(input.value))
    cancelBtn.addEventListener('click', () => close(null))
    stopBtn.addEventListener('click', () => {
      onStop?.()
      close(null)
    })
    input.addEventListener('keydown', handleInputKey)
    document.addEventListener('keydown', handleEscape)

    onOpen?.({ dismiss: () => close(null) })
    input.focus()
  })
}
