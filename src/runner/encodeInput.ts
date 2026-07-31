export type InputEncodeResult =
  | { ok: false }
  | { ok: true; bytes: Uint8Array }

// input() モーダルの戻り値を SAB へ書き込めるバイト列に変換する。
// キャンセル（null）と、SABのデータ領域に収まらない入力は ok: false として区別せず扱う
// （呼び出し側で customInput() の「キャンセル」パス = 空文字に合流させる）。
export function encodeInputValue(value: string | null, maxBytes: number): InputEncodeResult {
  if (value === null) return { ok: false }
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > maxBytes) return { ok: false }
  return { ok: true, bytes }
}
