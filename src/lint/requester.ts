import { parseLintResult, type LintResult } from './result'

export interface LintRequesterDeps {
  readonly nextId: () => number
  readonly post: (message: { type: 'lint'; id: number; code: string }) => void
  readonly timeoutMs: number
  readonly maxChars: number
}

export interface LintRequester {
  request: (code: string) => Promise<LintResult>
  // lint 関連のメッセージを処理したら true（補完側のハンドラに回さない）
  handle: (msg: { type: string; id?: number; result?: unknown }) => boolean
  failAll: () => void
}

// 入力のたびに要求が飛ぶので、待つのは最新の 1 件だけにする（古い要求は superseded で即解決）
export function createLintRequester(deps: LintRequesterDeps): LintRequester {
  const pending = new Map<number, (result: LintResult) => void>()

  const supersedeAll = (): void => {
    for (const done of [...pending.values()]) done({ status: 'superseded' })
    pending.clear()
  }

  return {
    request(code) {
      supersedeAll()
      if (code.length > deps.maxChars) return Promise.resolve({ status: 'too_large' })
      const id = deps.nextId()
      return new Promise<LintResult>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          resolve({ status: 'timeout' })
        }, deps.timeoutMs)
        pending.set(id, (result) => {
          clearTimeout(timer)
          resolve(result)
        })
        deps.post({ type: 'lint', id, code })
      })
    },

    handle(msg) {
      if (msg.type !== 'linted' && msg.type !== 'lint_error') return false
      const done = typeof msg.id === 'number' ? pending.get(msg.id) : undefined
      if (!done) return true
      pending.delete(msg.id as number)
      done(
        msg.type === 'linted'
          ? (parseLintResult(msg.result) ?? { status: 'unavailable' })
          : { status: 'unavailable' },
      )
      return true
    },

    failAll() {
      for (const done of [...pending.values()]) done({ status: 'unavailable' })
      pending.clear()
    },
  }
}
