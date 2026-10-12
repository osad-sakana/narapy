import { appendLog } from './log'
import { showInlineInput, type InputPromptHandle } from './inputPrompt'
import { formatTracePreview } from './inputFormat'
import { setRunStatus } from './runStatus'

export interface InputBuffers {
  status: Int32Array
  data: Uint8Array
}

export interface InputRequestDeps {
  // Worker ごとに SAB が変わるため、書き込み時点の最新値を取得する
  getBuffers: () => InputBuffers | null
  isRunning: () => boolean
  pauseTimeout: () => void
  resumeTimeout: () => void
  ensureLogVisible: () => void
  // ステップ実行の注記を1回の実行につき1度だけ出すための判定（初回のみ true）
  consumeTraceNote: () => boolean
  onOpen: (handle: InputPromptHandle | null) => void
}

// Worker の input_request を処理する。入力欄を出し、確定した値を SAB に書いて Worker を起こす。
// preview が非 null のときはステップ実行の記録中で、print と input() のエコーは
// バッファへ隠れるため、ここでログへ直接出す。
export async function handleInputRequest(
  deps: InputRequestDeps,
  prompt: string,
  preview: string | null,
): Promise<void> {
  // ユーザーの入力待ちの間はタイムアウトを止め、考える時間を強制停止のカウントに含めない
  deps.pauseTimeout()
  setRunStatus('waiting')
  deps.ensureLogVisible()

  const previewText = preview === null ? null : formatTracePreview(preview)
  if (previewText !== null) appendLog(previewText, 'output')
  if (preview !== null && deps.consumeTraceNote()) {
    appendLog('--- ステップ実行: 入力値は記録され、ステップ再生で確認できます ---', 'info')
  }

  const result = await showInlineInput(prompt, deps.onOpen)
  deps.onOpen(null)

  const buffers = deps.getBuffers()
  if (deps.isRunning()) {
    setRunStatus('running')
    deps.resumeTimeout()
  }
  if (!buffers) return // hardStop 済み（古い Worker 宛の SAB には書かない）

  if (result === null) {
    Atomics.store(buffers.status, 0, -1) // 停止操作 → Python 側で KeyboardInterrupt
  } else {
    if (preview !== null) appendLog(prompt + result.value, 'output')
    buffers.data.set(result.bytes)
    Atomics.store(buffers.status, 0, result.bytes.length)
  }
  Atomics.notify(buffers.status, 0)
}
