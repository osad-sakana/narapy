export interface TranslatedError {
  line: number | null
  errorType: string
  description: string
  hint?: string
  // false の場合、description は定型文または部分的な日本語化にとどまり、
  // rawMessage に英語原文が入る（ログ画面での未翻訳バッジ表示に使う）
  matched: boolean
  rawMessage: string
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
  // メッセージ全体をそのまま日本語テンプレに埋め込むだけの総括ルールに付ける。
  // ヒットしても「翻訳ルールが実際に効いた」とは言えないため matched: false 扱いにする
  generic?: true
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
    {
      pattern: /\w+\(\) missing (\d+) required positional arguments?: (.+)/,
      description: (count, names) => `関数の呼び出しに必要な引数が ${count} 個足りません（${names}）。`,
      hint: () => `関数を呼び出すときは、定義されているすべての引数を渡す必要があります。`,
    },
    {
      pattern: /\w+\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/,
      description: (expected, actual) => `関数は引数を ${expected} 個受け取りますが、${actual} 個渡されました。`,
      hint: () => `関数の定義と呼び出し箇所で、引数の数が合っているか確認してください。`,
    },
    {
      pattern: /'(\w+)' object does not support item assignment/,
      description: (t) => `${jpType(t)} には [ ] を使った代入ができません。`,
      hint: () => `文字列やタプルは変更できません（イミュータブル）。リストに変換するか、新しい値を作り直してください。`,
    },
  ],

  NameError: [
    {
      pattern: /name '(\w+)' is not defined\. Did you mean: '(\w+)'\?/,
      description: (name) => `変数・関数 "${name}" が定義されていません。`,
      hint: (_name, suggestion) =>
        `もしかして "${suggestion}" の間違いではありませんか？\nスペルミスがないか確認してください。`,
    },
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
    {
      pattern: /pop from empty list/,
      description: () => `空のリストから pop() しようとしました。`,
      hint: () => `pop() する前にリストの要素数を確認してください。`,
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
      pattern: /'(\w+)' object has no attribute '(\w+)'\. Did you mean: '(\w+)'\?/,
      description: (t, attr) => `${jpType(t)} には "${attr}" という属性・メソッドはありません。`,
      hint: (_t, _attr, suggestion) =>
        `もしかして "${suggestion}" の間違いではありませんか？\nスペルミスがないか確認してください。`,
    },
    {
      pattern: /'(\w+)' object has no attribute '(\w+)'/,
      description: (t, attr) => `${jpType(t)} には "${attr}" という属性・メソッドはありません。`,
      hint: () => `スペルミスがないか確認してください。`,
    },
    {
      pattern: /module '([\w.]+)' has no attribute '(\w+)'\. Did you mean: '(\w+)'\?/,
      description: (mod, attr) => `モジュール "${mod}" に "${attr}" はありません。`,
      hint: (_mod, _attr, suggestion) =>
        `もしかして "${suggestion}" の間違いではありませんか？\nスペルミスがないか確認してください。`,
    },
    {
      pattern: /module '([\w.]+)' has no attribute '(\w+)'/,
      description: (mod, attr) => `モジュール "${mod}" に "${attr}" はありません。`,
      hint: () => `関数名・属性名のスペルミスがないか確認してください。`,
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
      pattern: /not enough values to unpack \(expected (\d+), got (\d+)\)/,
      description: (expected, got) => `${expected} 個の変数に代入しようとしましたが、値は ${got} 個しかありません。`,
      hint: () => `左辺の変数の数と、右辺の要素の数を合わせてください。`,
    },
    {
      pattern: /too many values to unpack \(expected (\d+)\)/,
      description: (expected) => `代入先の変数は ${expected} 個ですが、値のほうが多すぎます。`,
      hint: () => `左辺の変数の数と、右辺の要素の数を合わせてください。`,
    },
    {
      pattern: /substring not found/,
      description: () => `指定した文字列が見つかりませんでした。`,
      hint: () => `見つからない場合に -1 を返す find() を使うか、in 演算子で存在を確認してから index() を使ってください。`,
    },
    {
      pattern: /list\.remove\(x\): x not in list/,
      description: () => `リストに存在しない要素を remove() しようとしました。`,
      hint: () => `remove() する前に in 演算子で要素の存在を確認してください。`,
    },
    {
      pattern: /(.+)/,
      description: (msg) => `値が不正です: ${msg}`,
      generic: true,
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
      pattern: /expected an indented block after '(\w+)' statement on line (\d+)/,
      description: (kw, ln) => `${ln}行目の「${kw}」の中身がインデント（字下げ）されていません。`,
      hint: () => `if・for・while などのブロックの中身はスペース4つで字下げしてください。`,
    },
    {
      pattern: /expected an indented block after function definition on line (\d+)/,
      description: (ln) => `${ln}行目の関数定義の中身がインデント（字下げ）されていません。`,
      hint: () => `def の後のブロックはスペース4つで字下げしてください。`,
    },
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

  TabError: [
    {
      pattern: /inconsistent use of tabs and spaces in indentation/,
      description: () => `タブとスペースが混在しています。`,
      hint: () => `インデントはスペースかタブのどちらかに統一してください（このエディタではスペース4つを推奨）。`,
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
      pattern: /expected ':'/,
      description: () => `コロン（:）が必要です。`,
      hint: () => `if・for・while・def などの行の最後にコロン（:）を付けてください。`,
    },
    {
      pattern: /'\(' was never closed/,
      description: () => `開き括弧 "(" が閉じられていません。`,
      hint: () => `対応する閉じ括弧 ")" を追加してください。`,
    },
    {
      pattern: /'\[' was never closed/,
      description: () => `開き括弧 "[" が閉じられていません。`,
      hint: () => `対応する閉じ括弧 "]" を追加してください。`,
    },
    {
      pattern: /'\{' was never closed/,
      description: () => `開き括弧 "{" が閉じられていません。`,
      hint: () => `対応する閉じ括弧 "}" を追加してください。`,
    },
    {
      pattern: /unmatched '\)'/,
      description: () => `対応する開き括弧のない ")" があります。`,
      hint: () => `括弧の数が合っているか確認してください。`,
    },
    {
      pattern: /unmatched '\]'/,
      description: () => `対応する開き括弧のない "]" があります。`,
    },
    {
      pattern: /unmatched '\}'/,
      description: () => `対応する開き括弧のない "}" があります。`,
    },
    {
      pattern: /unterminated triple-quoted string literal/,
      description: () => `三重引用符の文字列が閉じられていません。`,
    },
    {
      pattern: /unterminated string literal/,
      description: () => `文字列が閉じられていません。`,
      hint: () => `引用符（" または '）が対応しているか確認してください。`,
    },
    {
      pattern: /invalid character '(.+)' \(U\+[0-9A-Fa-f]+\)/,
      description: (ch) => `全角文字 "${ch}" が使われています。`,
      hint: () => `記号や区切り文字は半角で入力してください。全角のカンマ「，」や丸括弧「（）」に注意してください。`,
    },
    {
      pattern: /invalid non-printable character U\+3000/,
      description: () => `全角スペースが紛れ込んでいます。`,
      hint: () => `インデントや区切りには半角スペースを使ってください。`,
    },
    {
      pattern: /Missing parentheses in call to 'print'/,
      description: () => `print は関数なので、括弧 () を付けて呼び出す必要があります。`,
      hint: () => `例: print("こんにちは")`,
    },
    {
      pattern: /invalid syntax\. Perhaps you forgot a comma\?/,
      description: () => `文法エラーがあります。カンマ（,）が足りない可能性があります。`,
      hint: () => `リストや関数の引数の区切りにカンマがあるか確認してください。`,
    },
    {
      pattern: /invalid syntax\. Maybe you meant '==' or ':=' instead of '='\?/,
      description: () => `比較のつもりで代入の「=」を使っている可能性があります。`,
      hint: () => `値が等しいかを調べるときは「==」を使います。例: if x == 3:`,
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

  FileNotFoundError: [
    {
      pattern: /\[Errno 2\] No such file or directory: '(.*)'/,
      description: (path) => `ファイルまたはディレクトリ "${path}" が存在しません。`,
      hint: (path) => {
        if (path.includes('mnt') || path.includes('outputs') || path.includes('Downloads') || path.includes('Desktop')) {
          return `plt.savefig() でローカルパスへの保存はブラウザ上では動作しません。\nグラフはコード実行後に自動的にモーダルで表示されます。savefig() の行を削除してください。`
        }
        return `パスが正しいか確認してください。ブラウザ上ではローカルファイルシステムにアクセスできません。`
      },
    },
    {
      pattern: /\[Errno 44\] No such file or directory: '(.*)'/,
      description: (path) => `ファイルまたはディレクトリ "${path}" が存在しません。`,
      hint: () => `plt.savefig() でローカルパスへの保存はブラウザ上では動作しません。\nグラフはコード実行後に自動的にモーダルで表示されます。savefig() の行を削除してください。`,
    },
  ],

  ModuleNotFoundError: [
    {
      pattern: /No module named '(\w+)'/,
      description: (name) => `モジュール "${name}" が見つかりません。`,
      hint: () => `このブラウザ環境では使えないライブラリの可能性があります。`,
    },
  ],

  ImportError: [
    {
      pattern: /cannot import name '(\w+)' from '(\w+)'/,
      description: (name, mod) => `モジュール "${mod}" から "${name}" をインポートできません。`,
      hint: () => `名前のスペルミスや、そのモジュールに実際に存在するかを確認してください。`,
    },
  ],

  UnboundLocalError: [
    {
      pattern: /cannot access local variable '(\w+)' where it is not associated with a value/,
      description: (name) => `ローカル変数 "${name}" が代入前に使われています。`,
      hint: () =>
        `関数内でその変数に値を代入する行より前に使っていないか確認してください。同名のグローバル変数がある場合は global 宣言が必要です。`,
    },
    {
      pattern: /local variable '(\w+)' referenced before assignment/,
      description: (name) => `ローカル変数 "${name}" が代入前に使われています。`,
      hint: () =>
        `関数内でその変数に値を代入する行より前に使っていないか確認してください。同名のグローバル変数がある場合は global 宣言が必要です。`,
    },
  ],

  StopIteration: [
    {
      pattern: /(.*)/,
      description: () => `イテレータの要素がなくなりました。`,
    },
  ],
}

// Error/Exception/Warning で終わらない組み込み例外（すべて列挙する必要はなく、
// このプロジェクトが実際に扱うものだけを追加する）
const EXTRA_EXCEPTION_NAMES = new Set([
  'StopIteration',
  'StopAsyncIteration',
  'SystemExit',
  'KeyboardInterrupt',
  'GeneratorExit',
])

function isExceptionTypeName(name: string): boolean {
  return /(?:Error|Exception|Warning)$/.test(name) || EXTRA_EXCEPTION_NAMES.has(name)
}

// 末尾から遡り、インデントなし・例外型名で始まる行を探す。
// ドット区切りの型名（json.decoder.JSONDecodeError 等）や、メッセージを持たない
// 型名のみの行（素の assert 文による AssertionError 等）にも対応するため、
// 「行全体が \w+ とコロン」という単純な最終行マッチではなく型名らしさで判定する。
function findErrorHeader(raw: string): { errorType: string; message: string } | null {
  const lines = raw.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^([A-Za-z_][\w.]*)(?::\s*(.*))?$/)
    if (!m) continue
    const [, fullType, message = ''] = m
    const errorType = fullType.split('.').pop() ?? fullType
    if (isExceptionTypeName(errorType)) {
      return { errorType, message }
    }
  }
  return null
}

export function translatePythonError(raw: string): TranslatedError | null {
  const header = findErrorHeader(raw)
  if (!header) return null

  // ユーザーコード行番号を <exec> のトレースから抽出。
  // 関数呼び出しをまたぐと <exec> フレームが複数出るため、実際のエラー発生箇所に近い最後の一致を使う
  const lineMatches = [...raw.matchAll(/File "<exec>", line (\d+)/g)]
  const line = lineMatches.length > 0 ? parseInt(lineMatches[lineMatches.length - 1][1], 10) : null

  const { errorType, message } = header
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
          matched: !rule.generic,
          rawMessage: message,
        }
      }
    }
  }

  // どのルールにもマッチしなかった場合は英語原文を description に混ぜず、
  // rawMessage 側に退避する（未翻訳バッジ・GitHub Issue起票リンクの元データになる）
  return {
    line,
    errorType,
    description: 'このエラーはまだ日本語で説明できません。',
    matched: false,
    rawMessage: message || errorType,
  }
}
