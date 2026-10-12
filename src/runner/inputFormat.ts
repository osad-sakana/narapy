// ステップ実行の記録中は print の出力がバッファへ隠れるため、input() の直前に
// ログへ出す「ここまでの出力」を整形する。表示するものが無ければ null。
export function formatTracePreview(preview: string): string | null {
  const trimmed = preview.replace(/\n+$/, '')
  return trimmed === '' ? null : trimmed
}

export function tooLongMessage(byteLength: number, maxBytes: number): string {
  return `入力が長すぎます（${byteLength}バイト / 上限${maxBytes}バイト）`
}
