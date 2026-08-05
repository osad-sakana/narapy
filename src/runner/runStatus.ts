// ヘッダーの実行ステータス表示（#runStatusDot / #runStatusLabel）。
// 実行ボタン自体は「実行/停止」の操作を示すのに対し、こちらは直近の実行結果まで含めた状態を示す。
export type RunStatus = 'idle' | 'running' | 'done' | 'error'

const DOT_BASE = 'w-1.5 h-1.5 rounded-full shrink-0'

const STATUS: Record<RunStatus, { dot: string; label: string }> = {
  idle:    { dot: `${DOT_BASE} bg-muted`,                  label: '待機中' },
  running: { dot: `${DOT_BASE} bg-accent animate-pulse`,   label: '実行中' },
  done:    { dot: `${DOT_BASE} bg-success`,                label: '完了' },
  error:   { dot: `${DOT_BASE} bg-danger`,                 label: 'エラー' },
}

export function setRunStatus(status: RunStatus): void {
  const dot = document.getElementById('runStatusDot')
  const label = document.getElementById('runStatusLabel')
  if (!dot || !label) return
  dot.className = STATUS[status].dot
  label.textContent = STATUS[status].label
}
