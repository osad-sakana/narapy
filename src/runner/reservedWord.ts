// SyntaxError: invalid syntax のとき、エラー行から「予約語を名前に使っている」ことを見つける。
// Python 3.12 は `class = 1` のような誤用でも予約語名を含まない素の "invalid syntax" を返すため、
// メッセージだけでは分からない。トレースバックに含まれるソース行を調べて補う。

// Python 3.12 の keyword.kwlist（True/False/None を含む。match/case/type/_ は名前として合法なので含めない）
const PYTHON_KEYWORDS = [
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
] as const

// JS の \b は ASCII 専用で、日本語の変数名（合計for など）の途中に反応してしまうため Unicode で境界を取る
const NOT_AFTER = '(?<![\\p{L}\\p{N}_])'
const NOT_BEFORE = '(?![\\p{L}\\p{N}_])'
const KW = `(${PYTHON_KEYWORDS.join('|')})`
const KW_NO_CONSTANTS = `(${PYTHON_KEYWORDS.filter((k) => k !== 'True' && k !== 'False' && k !== 'None').join('|')})`
const ASSIGN_OPS = '(?:=(?!=)|\\*\\*=|\\*=|//=|/=|\\+=|-=|%=|@=|&=|\\|=|\\^=|>>=|<<=|:=)'

// 合法な Python には現れない並びだけを選ぶ（SyntaxError が出ている行にだけ適用する）
const MISUSE_PATTERNS: RegExp[] = [
  // class = 1 / obj.class = 1 / a = class = 1 / class += 1 / f(class=1)
  // `x not = 1` の not を拾わないよう、名前を置ける位置（行頭・; ( , の後・. の直後・単独の = の後）に限る
  new RegExp(`(?:^|[;(,]|\\.|(?<![=!<>])=(?!=))\\s*${KW}${NOT_BEFORE}\\s*${ASSIGN_OPS}`, 'u'),
  // if x: class = 1 / for i in r: class = i（1行の複合文）。x: None = 5 の型注釈を拾わないよう True/False/None は除く
  new RegExp(`:\\s*${KW_NO_CONSTANTS}${NOT_BEFORE}\\s*${ASSIGN_OPS}`, 'u'),
  // for class in ...
  new RegExp(`${NOT_AFTER}for\\s+${KW}${NOT_BEFORE}\\s+in${NOT_BEFORE}`, 'u'),
  // ... as class
  new RegExp(`${NOT_AFTER}as\\s+${KW}${NOT_BEFORE}`, 'u'),
  // import class / import os, class
  new RegExp(
    `${NOT_AFTER}import\\s+(?:[\\p{L}\\p{N}_.]+(?:\\s+as\\s+[\\p{L}\\p{N}_]+)?\\s*,\\s*)*${KW}${NOT_BEFORE}`,
    'u',
  ),
  // lambda class: 1
  new RegExp(`${NOT_AFTER}lambda\\s+(?:[^:]*?,\\s*)?\\**\\s*${KW}${NOT_BEFORE}\\s*[,:=]`, 'u'),
  // def for(): / class if:
  // `for class in` の class を「class 文の名前が in」と誤読しないよう、for/as/import より後ろに置く
  new RegExp(`${NOT_AFTER}(?:def|class)\\s+${KW}${NOT_BEFORE}`, 'u'),
]

// def f(class) / def f(a, *class) の引数位置
const DEF_PARAMS = new RegExp(`${NOT_AFTER}def\\s+[\\p{L}_][\\p{L}\\p{N}_]*\\s*\\(([^)]*)`, 'u')
const PARAM_KEYWORD = new RegExp(`(?:^|,)\\s*\\*{0,2}\\s*${KW}${NOT_BEFORE}\\s*(?:[,):=]|$)`, 'u')

// 文字列リテラルの中身と # コメントを空白にする（長さは保つ）。
// 1行だけを見るので、複数行の三重引用符の途中の行は扱えない（その場合は検出できず汎用翻訳に戻るだけ）
export function stripStringsAndComments(line: string): string {
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '#') {
      out.push(' '.repeat(line.length - i))
      break
    }
    if (ch === '"' || ch === "'") {
      const quote = line.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch
      let j = i + quote.length
      while (j < line.length && !line.startsWith(quote, j)) {
        j += line[j] === '\\' ? 2 : 1
      }
      const end = Math.min(j + quote.length, line.length)
      out.push(' '.repeat(end - i))
      i = end
      continue
    }
    out.push(ch)
    i += 1
  }
  return out.join('')
}

// 最後の <exec> フレームの直後の1行（エラー行のソース）を返す。
// Pyodide 内部のフレーム（await CodeRunner( ...）や、exec()/import 先の別フレームの行を拾って
// 誤検出しないよう、「ソース行＋キャレット」が例外ヘッダの直前に続く形のときだけ返す
export function extractErrorSourceLine(raw: string): string | null {
  const lines = raw.split(/\r?\n/)
  let frame = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*File "<exec>", line \d+/.test(lines[i])) {
      frame = i
      break
    }
  }
  if (frame < 0 || frame + 1 >= lines.length) return null

  const next = lines[frame + 1]
  const isIndented = /^\s+\S/.test(next)
  const isCaretLine = /^\s*[\^~\s]*$/.test(next)
  if (!isIndented || isCaretLine) return null

  const rest = lines.slice(frame + 2)
  const header = rest.findIndex((l) => !/^\s*[\^~\s]*$/.test(l))
  if (header < 0 || !/^\S/.test(rest[header])) return null
  return next.trim()
}

// 文字列・コメントを除いた1行の中で、名前の位置に使われている予約語を返す
export function detectReservedWordMisuse(strippedLine: string): string | null {
  for (const pattern of MISUSE_PATTERNS) {
    const m = strippedLine.match(pattern)
    if (m) return m[1]
  }
  const params = strippedLine.match(DEF_PARAMS)
  if (params) {
    const m = params[1].match(PARAM_KEYWORD)
    if (m) return m[1]
  }
  return null
}

export function findMisusedReservedWord(raw: string): string | null {
  const source = extractErrorSourceLine(raw)
  if (source === null) return null
  return detectReservedWordMisuse(stripStringsAndComments(source))
}
