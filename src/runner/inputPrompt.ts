import { MAX_INPUT_BYTES } from '../types'
import { appendLogElement, setBeforeClearHook } from './log'
import { decideSubmit } from './inputFormat'

export interface InputPromptHandle {
  dismiss: () => void
}

export interface InputPromptResult {
  value: string
  bytes: Uint8Array
}

let nextPromptId = 0

interface InputRow {
  row: HTMLElement
  input: HTMLInputElement
  error: HTMLElement
}

function buildInputRow(prompt: string): InputRow {
  const inputId = `inlineInput-${nextPromptId++}`

  const row = document.createElement('div')
  row.className = 'flex flex-col gap-0.5 my-0.5'
  // 入力欄自体はログのコピー対象にしない（確定した値は Python のエコー行で残る）
  row.dataset.logExclude = 'true'

  const line = document.createElement('div')
  line.className = 'flex items-baseline gap-2'

  const input = document.createElement('input')
  input.id = inputId
  input.type = 'text'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.setAttribute('aria-label', prompt || 'input()')
  input.className = 'flex-1 min-w-0 px-2 py-0.5 rounded bg-editor text-ink text-sm border border-danger/60 focus:border-danger focus:outline-none'

  // これが input() の入力欄だと一目で分かるよう、小さな赤いバッジを添える
  const badge = document.createElement('span')
  badge.textContent = 'input'
  badge.className = 'text-[10px] leading-none font-bold text-danger border border-danger/60 rounded px-1 py-0.5 shrink-0 self-center'
  line.appendChild(badge)

  if (prompt) {
    const label = document.createElement('label')
    label.htmlFor = inputId
    label.className = 'text-code whitespace-pre-wrap break-all'
    label.textContent = prompt
    line.appendChild(label)
  }
  line.appendChild(input)

  const error = document.createElement('div')
  error.className = 'text-danger text-xs'
  error.setAttribute('role', 'alert')

  row.appendChild(line)
  row.appendChild(error)
  return { row, input, error }
}

// Python の input() に対応する、実行ログ末尾のインライン入力欄。
// モーダルと違い直前の出力を隠さず、ツールバーの停止ボタンも常に押せる。
// 確定すると入力欄は消え、「プロンプト+入力値」は Python 側のエコーとしてログに残る。
//
// onOpen で dismiss 関数を受け取れる。停止操作やログ消去で開いたままの入力欄を
// 外部から閉じるために使う（その場合は null で解決される）。
export function showInlineInput(
  prompt: string,
  onOpen?: (handle: InputPromptHandle) => void,
): Promise<InputPromptResult | null> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { row, input, error } = buildInputRow(prompt)
    appendLogElement(row)

    let closed = false
    const close = (result: InputPromptResult | null): void => {
      if (closed) return
      closed = true
      row.remove()
      setBeforeClearHook(null)
      previouslyFocused?.focus()
      resolve(result)
    }

    // Enter の既定動作（フォーカス中ボタンのクリック）を止めておかないと、
    // フォーカスを戻した先の実行/停止ボタンが発火してしまう。
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      const decision = decideSubmit(e, input.value, MAX_INPUT_BYTES)
      if (decision.action === 'ignore') return
      e.preventDefault()
      if (decision.action === 'error') {
        // 上限超過は黙って空文字にせず、入力欄を開いたまま理由を示す
        error.textContent = decision.message
        return
      }
      close({ value: decision.value, bytes: decision.bytes })
    })
    input.addEventListener('input', () => { error.textContent = '' })

    setBeforeClearHook(() => close(null))
    onOpen?.({ dismiss: () => close(null) })
    input.focus()
  })
}
