import { MAX_INPUT_BYTES } from '../types'
import { appendLogElement } from './log'
import { encodeInputValue } from './encodeInput'
import { tooLongMessage } from './inputFormat'

export interface InputPromptHandle {
  dismiss: () => void
}

export interface InputPromptResult {
  value: string
  bytes: Uint8Array
}

let nextPromptId = 0

// Python の input() に対応する、実行ログ末尾のインライン入力欄。
// モーダルと違い直前の出力を隠さず、ツールバーの停止ボタンも常に押せる。
// 確定すると入力欄は消え、「プロンプト+入力値」は Python 側のエコーとしてログに残る。
//
// onOpen で dismiss 関数を受け取れる。停止操作でワーカーごと再生成する際に、
// 開いたままの入力欄を外部から閉じるために使う（その場合は null で解決される）。
export function showInlineInput(
  prompt: string,
  onOpen?: (handle: InputPromptHandle) => void,
): Promise<InputPromptResult | null> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const inputId = `inlineInput-${nextPromptId++}`

    const row = document.createElement('div')
    row.className = 'flex flex-col gap-0.5 my-0.5'
    // 入力欄自体はログのコピー対象にしない（確定した値は Python のエコー行で残る）
    row.dataset.logExclude = 'true'

    const line = document.createElement('div')
    line.className = 'flex items-baseline gap-2'

    const label = document.createElement('label')
    label.htmlFor = inputId
    label.className = 'text-code whitespace-pre-wrap break-all'
    label.textContent = prompt

    const input = document.createElement('input')
    input.id = inputId
    input.type = 'text'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', prompt || 'input()')
    input.className = 'flex-1 min-w-0 px-2 py-0.5 rounded bg-editor text-ink text-sm border border-line focus:border-accent focus:outline-none'

    const error = document.createElement('div')
    error.className = 'text-danger text-xs'
    error.setAttribute('role', 'alert')

    if (prompt) line.appendChild(label)
    line.appendChild(input)
    row.appendChild(line)
    row.appendChild(error)
    appendLogElement(row)

    let closed = false
    const close = (result: InputPromptResult | null): void => {
      if (closed) return
      closed = true
      row.remove()
      previouslyFocused?.focus()
      resolve(result)
    }

    // IME 変換確定の Enter は送信しない。既定動作（フォーカス中ボタンのクリック）を
    // 止めておかないと、フォーカスを戻した先の実行/停止ボタンが発火してしまう。
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return
      e.preventDefault()
      const encoded = encodeInputValue(input.value, MAX_INPUT_BYTES)
      if (!encoded.ok) {
        // 上限超過は黙って空文字にせず、入力欄を開いたまま理由を示す
        if (encoded.reason === 'too_long') {
          error.textContent = tooLongMessage(encoded.byteLength, MAX_INPUT_BYTES)
        }
        return
      }
      close({ value: input.value, bytes: encoded.bytes })
    })
    input.addEventListener('input', () => { error.textContent = '' })

    onOpen?.({ dismiss: () => close(null) })
    input.focus()
  })
}
