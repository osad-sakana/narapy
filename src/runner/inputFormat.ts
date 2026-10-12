import { encodeInputValue } from './encodeInput'

// ステップ実行の記録中は print の出力がバッファへ隠れるため、input() の直前に
// ログへ出す「ここまでの出力」を整形する。表示するものが無ければ null。
export function formatTracePreview(preview: string): string | null {
  const trimmed = preview.replace(/\n+$/, '')
  return trimmed === '' ? null : trimmed
}

export function tooLongMessage(byteLength: number, maxBytes: number): string {
  return `入力が長すぎます（${byteLength}バイト / 上限${maxBytes}バイト）`
}

export type SubmitDecision =
  | { action: 'ignore' }
  | { action: 'error'; message: string }
  | { action: 'submit'; value: string; bytes: Uint8Array }

// 入力欄のキー押下を送信/エラー/無視に振り分ける（DOM から切り離してテストできるようにする）。
// IME 変換確定の Enter は送信しない。
export function decideSubmit(
  key: { key: string; isComposing: boolean },
  value: string,
  maxBytes: number,
): SubmitDecision {
  if (key.key !== 'Enter' || key.isComposing) return { action: 'ignore' }
  const encoded = encodeInputValue(value, maxBytes)
  if (!encoded.ok) {
    return encoded.reason === 'too_long'
      ? { action: 'error', message: tooLongMessage(encoded.byteLength, maxBytes) }
      : { action: 'ignore' }
  }
  return { action: 'submit', value, bytes: encoded.bytes }
}
