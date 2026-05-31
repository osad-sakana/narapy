export interface TranslatedError {
  line: number | null
  errorType: string
  description: string
  hint?: string
}

// Python の型名を日本語に
function jpType(pyType: string): string {
  const map: Record<string, string> = {
    str: '文字列（str）',
    int: '整数（int）',
    float: '小数（float）',
    bool: '真偽値（bool）',
    list: 'リスト（list）',
    tuple: 'タプル（tuple）',
    dict: '辞書（dict）',
    set: '集合（set）',
    NoneType: 'None',
    function: '関数',
    type: 'クラス',
  }
  return map[pyType] ?? `${pyType}`
}

interface Rule {
  pattern: RegExp
  description: (...groups: string[]) => string
  hint?: (...groups: string[]) => string
}

const RULES: Record<string, Rule[]> = {
  TypeError: [
    {
      pattern: /can only concatenate str \(not "(\w+)"\) to str/,
      description: (t) => `文字列に ${jpType(t)} を「+」でつなごうとしました。`,
      hint: (t) => `${jpType(t)} を str() で文字列に変換してください。\n例: "点数: " + str(score)`,
    },
    {
      pattern: /can only concatenate (\w+) \(not "(\w+)"\) to \1/,
      description: (a, b) => `${jpType(a)} に ${jpType(b)} を「+」でつなごうとしました。`,
      hint: () => `同じ型どうしでのみ「+」で結合できます。`,
    },
    {
      pattern: /unsupported operand type\(s\) for (.+): '(\w+)' and '(\w+)'/,
      description: (op, a, b) => `${jpType(a)} と ${jpType(b)} の間で「${op.trim()}」演算はできません。`,
      hint: () => `int() や float() で数値に変換するか、str() で文字列に変換してから演算してください。`,
    },
    {
      pattern: /'(\w+)' object is not iterable/,
      description: (t) => `${jpType(t)} は繰り返し（for ループや list() など）に使えません。`,
      hint: () => `for ループにはリストや range() などを使ってください。`,
    },
    {
      pattern: /'(\w+)' object is not subscriptable/,
      description: (t) => `${jpType(t)} は [ ] でインデックスアクセスできません。`,
    },
    {
      pattern: /'(\w+)' object cannot be interpreted as an integer/,
      description: (t) => `${jpType(t)} を整数として使おうとしました。`,
      hint: () => `range() などには整数のみ渡せます。int() で変換してください。`,
    },
    {
      pattern: /object of type '(\w+)' has no len\(\)/,
      description: (t) => `${jpType(t)} には len() が使えません。`,
    },
    {
      pattern: /'(\w+)' object is not callable/,
      description: (t) => `${jpType(t)} は関数ではないため、呼び出せません。`,
      hint: () => `変数名と関数名が重複していないか確認してください。`,
    },
  ],

  NameError: [
    {
      pattern: /name '(\w+)' is not defined/,
      description: (name) => `変数・関数 "${name}" が定義されていません。`,
      hint: (name) => `スペルミスがないか確認してください。使う前に "${name} = ..." で定義が必要です。`,
    },
  ],

  ZeroDivisionError: [
    {
      pattern: /division by zero|integer division or modulo by zero/,
      description: () => `0 で割り算しようとしました。`,
      hint: () => `割る数が 0 になっていないか確認してください。`,
    },
  ],

  IndexError: [
    {
      pattern: /list index out of range/,
      description: () => `リストの範囲外にアクセスしようとしました。`,
      hint: () => `インデックスが 0 以上・リストの長さ未満であることを確認してください。`,
    },
    {
      pattern: /string index out of range/,
      description: () => `文字列の範囲外にアクセスしようとしました。`,
    },
    {
      pattern: /tuple index out of range/,
      description: () => `タプルの範囲外にアクセスしようとしました。`,
    },
  ],

  KeyError: [
    {
      pattern: /(.*)/,
      description: (key) => `辞書にキー ${key} が存在しません。`,
      hint: () => `in 演算子でキーの存在を確認してから取得してください。`,
    },
  ],

  AttributeError: [
    {
      pattern: /'(\w+)' object has no attribute '(\w+)'/,
      description: (t, attr) => `${jpType(t)} には "${attr}" という属性・メソッドはありません。`,
      hint: () => `スペルミスがないか確認してください。`,
    },
  ],

  ValueError: [
    {
      pattern: /invalid literal for int\(\) with base \d+: '(.*)'/,
      description: (v) => `"${v}" は整数に変換できません。`,
      hint: () => `数字だけからなる文字列のみ int() で変換できます。`,
    },
    {
      pattern: /could not convert string to float: '(.*)'/,
      description: (v) => `"${v}" は小数に変換できません。`,
    },
    {
      pattern: /math domain error/,
      description: () => `定義できない数学的計算をしようとしました。`,
      hint: () => `負の数の平方根など、実数では計算できない式がないか確認してください。`,
    },
    {
      pattern: /(.+)/,
      description: (msg) => `値が不正です: ${msg}`,
    },
  ],

  RecursionError: [
    {
      pattern: /maximum recursion depth exceeded/,
      description: () => `関数が無限に再帰呼び出しされて、限界を超えました。`,
      hint: () => `再帰を終了させる条件（ベースケース）が正しく設定されているか確認してください。`,
    },
  ],

  IndentationError: [
    {
      pattern: /expected an indented block/,
      description: () => `インデント（字下げ）が必要です。`,
      hint: () => `if・for・while・def などのブロックの中身はスペース4つで字下げしてください。`,
    },
    {
      pattern: /unexpected indent/,
      description: () => `予期しないインデント（字下げ）があります。`,
      hint: () => `不要なスペースが先頭に入っていないか確認してください。`,
    },
    {
      pattern: /unindent does not match any outer indentation level/,
      description: () => `インデントの深さが揃っていません。`,
      hint: () => `同じブロック内ではインデント（スペースの数）を統一してください。`,
    },
  ],

  SyntaxError: [
    {
      pattern: /EOL while scanning string literal/,
      description: () => `文字列が閉じられていません。`,
      hint: () => `引用符（" または '）が対応しているか確認してください。`,
    },
    {
      pattern: /EOF while scanning triple-quoted string literal/,
      description: () => `三重引用符の文字列が閉じられていません。`,
    },
    {
      pattern: /unexpected EOF while parsing/,
      description: () => `コードが途中で終わっています。`,
      hint: () => `括弧やブロックが閉じられていないか確認してください。`,
    },
    {
      pattern: /'return' outside function/,
      description: () => `return を関数の外で使っています。`,
      hint: () => `return は def で定義した関数の中でのみ使えます。`,
    },
    {
      pattern: /'break' outside loop/,
      description: () => `break をループの外で使っています。`,
    },
    {
      pattern: /'continue' outside loop/,
      description: () => `continue をループの外で使っています。`,
    },
    {
      pattern: /invalid syntax/,
      description: () => `文法エラーがあります。`,
      hint: () => `コロン（:）の付け忘れ、括弧の対応ミス、予約語のスペルミスなどを確認してください。`,
    },
  ],

  ModuleNotFoundError: [
    {
      pattern: /No module named '(\w+)'/,
      description: (name) => `モジュール "${name}" が見つかりません。`,
      hint: () => `このブラウザ環境では使えないライブラリの可能性があります。`,
    },
  ],

  StopIteration: [
    {
      pattern: /(.*)/,
      description: () => `イテレータの要素がなくなりました。`,
    },
  ],
}

export function translatePythonError(raw: string): TranslatedError | null {
  if (!raw.includes('Traceback') && !/^\w+(?:Error|Exception|Warning)/.test(raw)) {
    return null
  }

  // ユーザーコード行番号を <exec> のトレースから抽出
  const lineMatch = raw.match(/File "<exec>", line (\d+)/)
  const line = lineMatch ? parseInt(lineMatch[1], 10) : null

  // 最後の行からエラー種類・メッセージを抽出
  const lastLine = raw.trim().split('\n').pop() ?? ''
  const errorMatch = lastLine.match(/^(\w+):\s*(.*)/)
  if (!errorMatch) return null

  const [, errorType, message] = errorMatch
  const rules = RULES[errorType]

  if (rules) {
    for (const rule of rules) {
      const m = message.match(rule.pattern)
      if (m) {
        const groups = m.slice(1)
        return {
          line,
          errorType,
          description: rule.description(...groups),
          hint: rule.hint?.(...groups),
        }
      }
    }
  }

  // マッチしなかった場合はエラー種類のみ日本語化
  return {
    line,
    errorType,
    description: message || '詳細不明のエラーが発生しました。',
  }
}
