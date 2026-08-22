// 新規プロジェクト作成前に既存の作業内容を破棄してよいか確認する(issue #58)
export function confirmNewProject(
  confirmFn: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  return confirmFn('現在の作業内容を破棄して新規プロジェクトを作成します。よろしいですか？')
}
