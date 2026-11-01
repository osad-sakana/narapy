const OPENERS = '([{'
const CLOSERS = ')]}'

/**
 * 複合文の見出しを閉じるコロンの位置を返す（見つからなければ -1）。
 * 括弧・文字列の中、`:=`、lambda のコロンは見出しの終わりではないので飛ばす。
 * 1行で書かれた `if x: y = 1` を、見出しと本体に分けるために使う。
 * 既知の制約: Python 3.12 の f-string 内の同種の引用符の入れ子（f"{d["a:b"]}"）は追えない（logicalLines.ts も同様）。
 */
export function findHeaderColon(text: string): number {
  let depth = 0
  let quote: string | null = null
  let pendingLambdas = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i++
      else if (text.startsWith(quote, i)) {
        i += quote.length - 1
        quote = null
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = text.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch
      i += quote.length - 1
    } else if (OPENERS.includes(ch)) {
      depth++
    } else if (CLOSERS.includes(ch)) {
      depth = Math.max(0, depth - 1)
    } else if (depth === 0 && /^lambda(?![\p{L}\p{N}_])/u.test(text.slice(i)) && !/[\p{L}\p{N}_]/u.test(text[i - 1] ?? ' ')) {
      pendingLambdas++
    } else if (ch === ':' && depth === 0 && text[i + 1] !== '=') {
      if (pendingLambdas === 0) return i
      pendingLambdas--
    }
  }
  return -1
}
