export type InputEncodeResult =
  | { ok: false; reason: 'cancel' }
  | { ok: false; reason: 'too_long'; byteLength: number }
  | { ok: true; bytes: Uint8Array }

// 入力欄の値を SAB へ書き込めるバイト列に変換する。
// キャンセル（null）と、SABのデータ領域に収まらない入力は reason で区別する
// （上限超過は入力欄にエラーを出して再入力を促すため、バイト数も返す）。
export function encodeInputValue(value: string | null, maxBytes: number): InputEncodeResult {
  if (value === null) return { ok: false, reason: 'cancel' }
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > maxBytes) return { ok: false, reason: 'too_long', byteLength: bytes.length }
  return { ok: true, bytes }
}
