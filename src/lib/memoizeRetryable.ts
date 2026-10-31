export interface RetryableMemo<T> {
  (): Promise<T>
  reset: () => void
}

// 非同期処理の結果をメモし、失敗したらメモを捨てて次の呼び出しで再試行できるようにする。
// 古い試行の失敗が、その後に始まった新しい試行のメモを消さないよう同一性を確認する。
export function memoizeRetryable<T>(fn: () => Promise<T>): RetryableMemo<T> {
  let current: Promise<T> | null = null

  const get = ((): Promise<T> => {
    if (current) return current
    const attempt = fn()
    current = attempt
    attempt.catch(() => { if (current === attempt) current = null })
    return attempt
  }) as RetryableMemo<T>

  get.reset = () => { current = null }
  return get
}
