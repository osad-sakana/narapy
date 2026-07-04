// URLから読み込んだプロジェクトで既存の作業内容を上書きする前に確認する(issue #32)
export function confirmOverwriteExistingWork(
  confirmFn: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  return confirmFn('URL から読み込んだプロジェクトで現在の作業内容を置き換えます。よろしいですか？')
}
