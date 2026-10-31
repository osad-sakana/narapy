export type RawCompletion = {
  name: string
  type: string
  module: string
  parent: string
  parentType: string
  // 定義行（ユーザーコードのみ意味を持つ。不明は 0）と完全名（例: random.randint）
  line: number
  fullName: string
}

export type CompletionWorkerOut =
  | { type: 'ready' }
  | { type: 'completions'; id: number; items: RawCompletion[] }
  | { type: 'complete_error'; id: number }

export const META_FIELD_MAX_CHARS = 64

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

function sanitizeMeta(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(CONTROL_CHARS, '').slice(0, META_FIELD_MAX_CHARS)
}

// Worker から届く JSON を検証・正規化する。旧形式の {name, type} も受け付ける
export function parseCompletionItems(parsed: unknown): RawCompletion[] {
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item): RawCompletion[] => {
    if (typeof item !== 'object' || item === null) return []
    const rec = item as Record<string, unknown>
    if (typeof rec.name !== 'string' || rec.name === '' || typeof rec.type !== 'string') return []
    return [{
      name: rec.name,
      type: rec.type,
      module: sanitizeMeta(rec.module),
      parent: sanitizeMeta(rec.parent),
      parentType: sanitizeMeta(rec.parentType),
      line: typeof rec.line === 'number' && Number.isInteger(rec.line) && rec.line > 0 ? rec.line : 0,
      fullName: sanitizeMeta(rec.fullName),
    }]
  })
}
