import { parseFormatResult, type FormatResult } from './result'

export interface FormatRequesterDeps {
  readonly nextId: () => number
  readonly post: (message: { type: 'format'; id: number; code: string }) => void
  readonly timeoutMs: number
  readonly maxChars: number
}

export interface FormatRequester {
  request: (code: string) => Promise<FormatResult>
  // 整形関連のメッセージを処理したら true（補完側のハンドラに回さない）
  handle: (msg: { type: string; id?: number; result?: unknown }) => boolean
  failAll: () => void
}

export function createFormatRequester(deps: FormatRequesterDeps): FormatRequester {
  const pending = new Map<number, (result: FormatResult) => void>()

  return {
    request(code) {
      if (code.length > deps.maxChars) return Promise.resolve({ status: 'too_large' })
      const id = deps.nextId()
      return new Promise<FormatResult>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          resolve({ status: 'timeout' })
        }, deps.timeoutMs)
        pending.set(id, (result) => {
          clearTimeout(timer)
          resolve(result)
        })
        deps.post({ type: 'format', id, code })
      })
    },

    handle(msg) {
      if (msg.type !== 'formatted' && msg.type !== 'format_error') return false
      const done = typeof msg.id === 'number' ? pending.get(msg.id) : undefined
      if (!done) return true
      pending.delete(msg.id as number)
      done(
        msg.type === 'formatted'
          ? (parseFormatResult(msg.result) ?? { status: 'unavailable' })
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
