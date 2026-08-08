import { describe, it, expect } from 'vitest'
import { translatePythonError } from './errorTranslator'

function traceback(errorLine: string, line = 3): string {
  return [
    'Traceback (most recent call last):',
    `  File "<exec>", line ${line}, in <module>`,
    errorLine,
  ].join('\n')
}

describe('translatePythonError（既存ルールの回帰）', () => {
  const cases: Array<{
    name: string
    raw: string
    line: number | null
    errorType: string
    description: string
    hint?: string
  }> = [
    {
      name: 'TypeError: str + int',
      raw: traceback('TypeError: can only concatenate str (not "int") to str'),
      line: 3,
      errorType: 'TypeError',
      description: '文字列に 整数（int） を「+」でつなごうとしました。',
      hint: '整数（int） を str() で文字列に変換してください。\n例: "点数: " + str(score)',
    },
    {
      name: 'TypeError: list + int（同型演算子ルール手前で単型ルールに先勝ちされない例）',
      raw: traceback('TypeError: can only concatenate list (not "int") to list'),
      line: 3,
      errorType: 'TypeError',
      description: 'リスト（list） に 整数（int） を「+」でつなごうとしました。',
    },
    {
      name: 'TypeError: unsupported operand',
      raw: traceback("TypeError: unsupported operand type(s) for +: 'int' and 'str'"),
      line: 3,
      errorType: 'TypeError',
      description: '整数（int） と 文字列（str） の間で「+」演算はできません。',
    },
    {
      name: 'TypeError: not iterable',
      raw: traceback("TypeError: 'int' object is not iterable"),
      line: 3,
      errorType: 'TypeError',
      description: '整数（int） は繰り返し（for ループや list() など）に使えません。',
    },
    {
      name: 'TypeError: not subscriptable',
      raw: traceback("TypeError: 'int' object is not subscriptable"),
      line: 3,
      errorType: 'TypeError',
      description: '整数（int） は [ ] でインデックスアクセスできません。',
    },
    {
      name: 'TypeError: cannot be interpreted as integer',
      raw: traceback("TypeError: 'str' object cannot be interpreted as an integer"),
      line: 3,
      errorType: 'TypeError',
      description: '文字列（str） を整数として使おうとしました。',
    },
    {
      name: 'TypeError: no len()',
      raw: traceback("TypeError: object of type 'int' has no len()"),
      line: 3,
      errorType: 'TypeError',
      description: '整数（int） には len() が使えません。',
    },
    {
      name: 'TypeError: not callable',
      raw: traceback("TypeError: 'int' object is not callable"),
      line: 3,
      errorType: 'TypeError',
      description: '整数（int） は関数ではないため、呼び出せません。',
    },
    {
      name: 'NameError',
      raw: traceback("NameError: name 'foo' is not defined"),
      line: 3,
      errorType: 'NameError',
      description: '変数・関数 "foo" が定義されていません。',
    },
    {
      name: 'ZeroDivisionError',
      raw: traceback('ZeroDivisionError: division by zero'),
      line: 3,
      errorType: 'ZeroDivisionError',
      description: '0 で割り算しようとしました。',
    },
    {
      name: 'IndexError: list',
      raw: traceback('IndexError: list index out of range'),
      line: 3,
      errorType: 'IndexError',
      description: 'リストの範囲外にアクセスしようとしました。',
    },
    {
      name: 'IndexError: string',
      raw: traceback('IndexError: string index out of range'),
      line: 3,
      errorType: 'IndexError',
      description: '文字列の範囲外にアクセスしようとしました。',
    },
    {
      name: 'IndexError: tuple',
      raw: traceback('IndexError: tuple index out of range'),
      line: 3,
      errorType: 'IndexError',
      description: 'タプルの範囲外にアクセスしようとしました。',
    },
    {
      name: 'KeyError',
      raw: traceback("KeyError: 'missing_key'"),
      line: 3,
      errorType: 'KeyError',
      description: "辞書にキー 'missing_key' が存在しません。",
    },
    {
      name: 'AttributeError',
      raw: traceback("AttributeError: 'int' object has no attribute 'append'"),
      line: 3,
      errorType: 'AttributeError',
      description: '整数（int） には "append" という属性・メソッドはありません。',
    },
    {
      name: 'ValueError: invalid literal for int()',
      raw: traceback("ValueError: invalid literal for int() with base 10: 'abc'"),
      line: 3,
      errorType: 'ValueError',
      description: '"abc" は整数に変換できません。',
    },
    {
      name: 'ValueError: could not convert string to float',
      raw: traceback("ValueError: could not convert string to float: 'abc'"),
      line: 3,
      errorType: 'ValueError',
      description: '"abc" は小数に変換できません。',
    },
    {
      name: 'ValueError: math domain error',
      raw: traceback('ValueError: math domain error'),
      line: 3,
      errorType: 'ValueError',
      description: '定義できない数学的計算をしようとしました。',
    },
    {
      name: 'ValueError: 総括ルール（未知のメッセージ）',
      raw: traceback('ValueError: unpacking too many values'),
      line: 3,
      errorType: 'ValueError',
      description: '値が不正です: unpacking too many values',
    },
    {
      name: 'RecursionError',
      raw: traceback('RecursionError: maximum recursion depth exceeded'),
      line: 3,
      errorType: 'RecursionError',
      description: '関数が無限に再帰呼び出しされて、限界を超えました。',
    },
    {
      name: 'IndentationError: expected an indented block',
      raw: traceback('IndentationError: expected an indented block'),
      line: 3,
      errorType: 'IndentationError',
      description: 'インデント（字下げ）が必要です。',
    },
    {
      name: 'IndentationError: unexpected indent',
      raw: traceback('IndentationError: unexpected indent'),
      line: 3,
      errorType: 'IndentationError',
      description: '予期しないインデント（字下げ）があります。',
    },
    {
      name: 'IndentationError: unindent mismatch',
      raw: traceback('IndentationError: unindent does not match any outer indentation level'),
      line: 3,
      errorType: 'IndentationError',
      description: 'インデントの深さが揃っていません。',
    },
    {
      name: 'SyntaxError: EOL while scanning string literal',
      raw: traceback('SyntaxError: EOL while scanning string literal'),
      line: 3,
      errorType: 'SyntaxError',
      description: '文字列が閉じられていません。',
    },
    {
      name: 'SyntaxError: EOF while scanning triple-quoted string literal',
      raw: traceback('SyntaxError: EOF while scanning triple-quoted string literal'),
      line: 3,
      errorType: 'SyntaxError',
      description: '三重引用符の文字列が閉じられていません。',
    },
    {
      name: 'SyntaxError: unexpected EOF while parsing',
      raw: traceback('SyntaxError: unexpected EOF while parsing'),
      line: 3,
      errorType: 'SyntaxError',
      description: 'コードが途中で終わっています。',
    },
    {
      name: "SyntaxError: 'return' outside function",
      raw: traceback("SyntaxError: 'return' outside function"),
      line: 3,
      errorType: 'SyntaxError',
      description: 'return を関数の外で使っています。',
    },
    {
      name: "SyntaxError: 'break' outside loop",
      raw: traceback("SyntaxError: 'break' outside loop"),
      line: 3,
      errorType: 'SyntaxError',
      description: 'break をループの外で使っています。',
    },
    {
      name: "SyntaxError: 'continue' outside loop",
      raw: traceback("SyntaxError: 'continue' outside loop"),
      line: 3,
      errorType: 'SyntaxError',
      description: 'continue をループの外で使っています。',
    },
    {
      name: 'SyntaxError: invalid syntax（総括ルール）',
      raw: traceback('SyntaxError: invalid syntax'),
      line: 3,
      errorType: 'SyntaxError',
      description: '文法エラーがあります。',
    },
    {
      name: 'FileNotFoundError: Errno 2',
      raw: traceback("FileNotFoundError: [Errno 2] No such file or directory: 'foo.txt'"),
      line: 3,
      errorType: 'FileNotFoundError',
      description: 'ファイルまたはディレクトリ "foo.txt" が存在しません。',
    },
    {
      name: 'FileNotFoundError: Errno 2 (savefig系パス)',
      raw: traceback("FileNotFoundError: [Errno 2] No such file or directory: '/mnt/outputs/fig.png'"),
      line: 3,
      errorType: 'FileNotFoundError',
      description: 'ファイルまたはディレクトリ "/mnt/outputs/fig.png" が存在しません。',
    },
    {
      name: 'FileNotFoundError: Errno 44',
      raw: traceback("FileNotFoundError: [Errno 44] No such file or directory: 'foo.txt'"),
      line: 3,
      errorType: 'FileNotFoundError',
      description: 'ファイルまたはディレクトリ "foo.txt" が存在しません。',
    },
    {
      name: 'ModuleNotFoundError',
      raw: traceback("ModuleNotFoundError: No module named 'numpy'"),
      line: 3,
      errorType: 'ModuleNotFoundError',
      description: 'モジュール "numpy" が見つかりません。',
    },
    {
      name: 'StopIteration',
      raw: traceback('StopIteration:'),
      line: 3,
      errorType: 'StopIteration',
      description: 'イテレータの要素がなくなりました。',
    },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const result = translatePythonError(c.raw)
      expect(result).not.toBeNull()
      expect(result?.line).toBe(c.line)
      expect(result?.errorType).toBe(c.errorType)
      expect(result?.description).toBe(c.description)
      if (c.hint !== undefined) {
        expect(result?.hint).toBe(c.hint)
      }
    })
  }

  it('具体ルールは総括ルールより優先される（ValueErrorの総括 (.+) に埋もれない）', () => {
    const result = translatePythonError(
      traceback("ValueError: invalid literal for int() with base 10: 'xyz'"),
    )
    expect(result?.description).toBe('"xyz" は整数に変換できません。')
  })

  it('Traceback を含まず ErrorType 単独行でも判定できる', () => {
    const result = translatePythonError("ZeroDivisionError: division by zero")
    expect(result?.errorType).toBe('ZeroDivisionError')
    expect(result?.line).toBeNull()
  })

  it('Traceback もエラー行も含まない文字列は null を返す', () => {
    expect(translatePythonError('こんにちは')).toBeNull()
  })

  it('未知の例外型は日本語の定型文になり、英語原文は rawMessage に退避される', () => {
    const result = translatePythonError(traceback('OverflowError: math range error'))
    expect(result?.errorType).toBe('OverflowError')
    expect(result?.matched).toBe(false)
    expect(result?.description).toBe('このエラーはまだ日本語で説明できません。')
    expect(result?.rawMessage).toBe('math range error')
  })
})

describe('translatePythonError（matched / rawMessage）', () => {
  it('個別ルールにヒットした場合は matched: true になる', () => {
    const result = translatePythonError(traceback('ZeroDivisionError: division by zero'))
    expect(result?.matched).toBe(true)
    expect(result?.rawMessage).toBe('division by zero')
  })

  it('ValueError の総括ルール（generic）にヒットした場合は matched: false になる', () => {
    const result = translatePythonError(traceback('ValueError: unpacking too many values'))
    expect(result?.matched).toBe(false)
    expect(result?.description).toBe('値が不正です: unpacking too many values')
    expect(result?.rawMessage).toBe('unpacking too many values')
  })

  it('KeyError の総括ルールは実質的な日本語訳のため matched: true になる', () => {
    const result = translatePythonError(traceback("KeyError: 'missing_key'"))
    expect(result?.matched).toBe(true)
  })

  it('StopIteration の総括ルールは実質的な日本語訳のため matched: true になる', () => {
    const result = translatePythonError(traceback('StopIteration:'))
    expect(result?.matched).toBe(true)
  })

  it('ルールにマッチしないメッセージが空の場合、rawMessage は errorType にフォールバックする', () => {
    const raw = ['Traceback (most recent call last):', '  File "<exec>", line 1, in <module>', 'AssertionError'].join(
      '\n',
    )
    const result = translatePythonError(raw)
    expect(result?.matched).toBe(false)
    expect(result?.rawMessage).toBe('AssertionError')
  })
})

describe('translatePythonError（ヘッダー抽出の堅牢化）', () => {
  it('素の assert によるメッセージなし・コロンなしの AssertionError を検出できる', () => {
    const raw = ['Traceback (most recent call last):', '  File "<exec>", line 1, in <module>', 'AssertionError'].join(
      '\n',
    )
    const result = translatePythonError(raw)
    expect(result?.errorType).toBe('AssertionError')
    expect(result?.line).toBe(1)
  })

  it('ドット付き型名（json.decoder.JSONDecodeError）から短い型名を抽出できる', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 2, in <module>',
      'json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)',
    ].join('\n')
    const result = translatePythonError(raw)
    expect(result?.errorType).toBe('JSONDecodeError')
    expect(result?.matched).toBe(false)
    expect(result?.rawMessage).toBe('Expecting value: line 1 column 1 (char 0)')
  })

  it('SyntaxError の複数行メッセージ（問題箇所のコード行・キャレット行）を無視してヘッダー行を拾える', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 2',
      '    print "hello"',
      '                 ^',
      "SyntaxError: Missing parentheses in call to 'print'. Did you mean print(...)?",
    ].join('\n')
    const result = translatePythonError(raw)
    expect(result?.errorType).toBe('SyntaxError')
    expect(result?.line).toBe(2)
  })
})

describe('translatePythonError（SyntaxError: Python 3.12 の新しいメッセージ）', () => {
  const cases: Array<{ name: string; raw: string; description: string }> = [
    {
      name: "expected ':'（コロン忘れ）",
      raw: traceback("SyntaxError: expected ':'"),
      description: 'コロン（:）が必要です。',
    },
    {
      name: "'(' was never closed（丸括弧閉じ忘れ）",
      raw: traceback("SyntaxError: '(' was never closed"),
      description: '開き括弧 "(" が閉じられていません。',
    },
    {
      name: "'[' was never closed（角括弧閉じ忘れ）",
      raw: traceback("SyntaxError: '[' was never closed"),
      description: '開き括弧 "[" が閉じられていません。',
    },
    {
      name: "unmatched ')'（対応する開き括弧がない）",
      raw: traceback("SyntaxError: unmatched ')'"),
      description: '対応する開き括弧のない ")" があります。',
    },
    {
      name: 'unterminated string literal',
      raw: traceback('SyntaxError: unterminated string literal (detected at line 3)'),
      description: '文字列が閉じられていません。',
    },
    {
      name: 'unterminated triple-quoted string literal',
      raw: traceback('SyntaxError: unterminated triple-quoted string literal (detected at line 5)'),
      description: '三重引用符の文字列が閉じられていません。',
    },
    {
      name: '全角文字混入（invalid character）',
      raw: traceback("SyntaxError: invalid character '，' (U+FF0C)"),
      description: '全角文字 "，" が使われています。',
    },
    {
      name: '全角スペース混入（invalid non-printable character）',
      raw: traceback('SyntaxError: invalid non-printable character U+3000'),
      description: '全角スペースが紛れ込んでいます。',
    },
    {
      name: "print文（Python2構文）",
      raw: traceback("SyntaxError: Missing parentheses in call to 'print'. Did you mean print(...)?"),
      description: 'print は関数なので、括弧 () を付けて呼び出す必要があります。',
    },
    {
      name: 'カンマ忘れ（Perhaps you forgot a comma?）',
      raw: traceback('SyntaxError: invalid syntax. Perhaps you forgot a comma?'),
      description: '文法エラーがあります。カンマ（,）が足りない可能性があります。',
    },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const result = translatePythonError(c.raw)
      expect(result?.errorType).toBe('SyntaxError')
      expect(result?.matched).toBe(true)
      expect(result?.description).toBe(c.description)
    })
  }

  it('従来の invalid syntax（総括ルール）は新ルールに埋もれず残っている', () => {
    const result = translatePythonError(traceback('SyntaxError: invalid syntax'))
    expect(result?.description).toBe('文法エラーがあります。')
  })
})

describe('translatePythonError（IndentationError詳細化 + TabError）', () => {
  it('if文の中身のインデント忘れ（行番号・キーワード付き）', () => {
    const result = translatePythonError(
      traceback("IndentationError: expected an indented block after 'if' statement on line 3"),
    )
    expect(result?.description).toBe('3行目の「if」の中身がインデント（字下げ）されていません。')
  })

  it('関数定義の中身のインデント忘れ', () => {
    const result = translatePythonError(
      traceback('IndentationError: expected an indented block after function definition on line 5'),
    )
    expect(result?.description).toBe('5行目の関数定義の中身がインデント（字下げ）されていません。')
  })

  it('詳細情報のない expected an indented block はフォールバックする', () => {
    const result = translatePythonError(traceback('IndentationError: expected an indented block'))
    expect(result?.description).toBe('インデント（字下げ）が必要です。')
  })

  it('TabError: タブとスペースの混在', () => {
    const result = translatePythonError(
      traceback('TabError: inconsistent use of tabs and spaces in indentation'),
    )
    expect(result?.errorType).toBe('TabError')
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('タブとスペースが混在しています。')
  })
})

describe('translatePythonError（NameErrorのタイポ候補ヒント）', () => {
  it('Pyodide (Python 3.12) の "Did you mean" 付きメッセージから候補をヒントに出す', () => {
    const result = translatePythonError(
      traceback("NameError: name 'prnt' is not defined. Did you mean: 'print'?"),
    )
    expect(result?.description).toBe('変数・関数 "prnt" が定義されていません。')
    expect(result?.hint).toBe('もしかして "print" の間違いではありませんか？\nスペルミスがないか確認してください。')
  })

  it('候補なしの従来メッセージは既存のヒントにフォールバックする', () => {
    const result = translatePythonError(traceback("NameError: name 'foo' is not defined"))
    expect(result?.description).toBe('変数・関数 "foo" が定義されていません。')
    expect(result?.hint).toBe('スペルミスがないか確認してください。使う前に "foo = ..." で定義が必要です。')
  })
})

describe('translatePythonError（TypeError / UnboundLocalError / ImportError の追加ルール）', () => {
  it('TypeError: 必須の位置引数が不足（単数）', () => {
    const result = translatePythonError(traceback("TypeError: greet() missing 1 required positional argument: 'name'"))
    expect(result?.description).toBe("関数の呼び出しに必要な引数が 1 個足りません（'name'）。")
  })

  it('TypeError: 必須の位置引数が不足（複数）', () => {
    const result = translatePythonError(
      traceback("TypeError: greet() missing 2 required positional arguments: 'name' and 'age'"),
    )
    expect(result?.description).toBe("関数の呼び出しに必要な引数が 2 個足りません（'name' and 'age'）。")
  })

  it('TypeError: 引数の数が多すぎる', () => {
    const result = translatePythonError(traceback('TypeError: greet() takes 1 positional argument but 2 were given'))
    expect(result?.description).toBe('関数は引数を 1 個受け取りますが、2 個渡されました。')
  })

  it('TypeError: item assignment 非対応（文字列への [] 代入）', () => {
    const result = translatePythonError(traceback("TypeError: 'str' object does not support item assignment"))
    expect(result?.description).toBe('文字列（str） には [ ] を使った代入ができません。')
  })

  it('ImportError: cannot import name', () => {
    const result = translatePythonError(traceback("ImportError: cannot import name 'foo' from 'bar'"))
    expect(result?.errorType).toBe('ImportError')
    expect(result?.description).toBe('モジュール "bar" から "foo" をインポートできません。')
  })

  it('UnboundLocalError: Python 3.11+ の新しいメッセージ', () => {
    const result = translatePythonError(
      traceback("UnboundLocalError: cannot access local variable 'x' where it is not associated with a value"),
    )
    expect(result?.errorType).toBe('UnboundLocalError')
    expect(result?.description).toBe('ローカル変数 "x" が代入前に使われています。')
  })

  it('UnboundLocalError: 従来のメッセージ', () => {
    const result = translatePythonError(
      traceback("UnboundLocalError: local variable 'x' referenced before assignment"),
    )
    expect(result?.description).toBe('ローカル変数 "x" が代入前に使われています。')
  })
})

describe('translatePythonError（レビュー対応: ValueError/IndexError/AttributeError/SyntaxErrorの追加ルール）', () => {
  it('ValueError: アンパック不足', () => {
    const result = translatePythonError(
      traceback('ValueError: not enough values to unpack (expected 2, got 1)'),
    )
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('2 個の変数に代入しようとしましたが、値は 1 個しかありません。')
  })

  it('ValueError: アンパックしすぎ', () => {
    const result = translatePythonError(traceback('ValueError: too many values to unpack (expected 2)'))
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('代入先の変数は 2 個ですが、値のほうが多すぎます。')
  })

  it('ValueError: substring not found', () => {
    const result = translatePythonError(traceback('ValueError: substring not found'))
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('指定した文字列が見つかりませんでした。')
  })

  it('ValueError: list.remove(x): x not in list', () => {
    const result = translatePythonError(traceback('ValueError: list.remove(x): x not in list'))
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('リストに存在しない要素を remove() しようとしました。')
  })

  it('IndexError: 空リストへのpop', () => {
    const result = translatePythonError(traceback('IndexError: pop from empty list'))
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('空のリストから pop() しようとしました。')
  })

  it('AttributeError: module形式（module has no attribute）', () => {
    const result = translatePythonError(traceback("AttributeError: module 'math' has no attribute 'sqr'"))
    expect(result?.errorType).toBe('AttributeError')
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('モジュール "math" に "sqr" はありません。')
  })

  it('AttributeError: Did you mean 候補付き', () => {
    const result = translatePythonError(
      traceback("AttributeError: 'list' object has no attribute 'appendd'. Did you mean: 'append'?"),
    )
    expect(result?.description).toBe('リスト（list） には "appendd" という属性・メソッドはありません。')
    expect(result?.hint).toBe('もしかして "append" の間違いではありませんか？\nスペルミスがないか確認してください。')
  })

  it('AttributeError: 候補なしは既存のヒントにフォールバックする', () => {
    const result = translatePythonError(traceback("AttributeError: 'int' object has no attribute 'append'"))
    expect(result?.hint).toBe('スペルミスがないか確認してください。')
  })

  it('SyntaxError: "=" と "==" の混同', () => {
    const result = translatePythonError(
      traceback("SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?"),
    )
    expect(result?.matched).toBe(true)
    expect(result?.description).toBe('比較のつもりで代入の「=」を使っている可能性があります。')
  })
})

describe('translatePythonError（レビュー対応: CRLF・複数フレームの行番号）', () => {
  it('CRLF終端でもヘッダーを検出できる', () => {
    const raw = traceback('ZeroDivisionError: division by zero') + '\r\n'
    const result = translatePythonError(raw)
    expect(result?.errorType).toBe('ZeroDivisionError')
  })

  it('複数の<exec>フレームがある場合、実際のエラー発生箇所に近い最後の行番号を使う', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 5, in <module>',
      '  File "<exec>", line 2, in f',
      'ZeroDivisionError: division by zero',
    ].join('\n')
    const result = translatePythonError(raw)
    expect(result?.line).toBe(2)
  })
})

describe('translatePythonError（2回目レビュー対応: module形式のDid you mean候補）', () => {
  it('module形式のAttributeErrorでもDid you mean候補をヒントに出す', () => {
    const result = translatePythonError(
      traceback("AttributeError: module 'math' has no attribute 'sqr'. Did you mean: 'sqrt'?"),
    )
    expect(result?.description).toBe('モジュール "math" に "sqr" はありません。')
    expect(result?.hint).toBe('もしかして "sqrt" の間違いではありませんか？\nスペルミスがないか確認してください。')
  })

  it('module形式で候補なしの場合は既存のヒントにフォールバックする', () => {
    const result = translatePythonError(traceback("AttributeError: module 'math' has no attribute 'foo'"))
    expect(result?.hint).toBe('関数名・属性名のスペルミスがないか確認してください。')
  })
})

describe('translatePythonError（4回目レビュー対応: SystemExitが構造化エラーブロックとして検出される）', () => {
  it('SystemExitはnullを返さず、未翻訳エラーとして検出される', () => {
    const result = translatePythonError(traceback('SystemExit: 1'))
    expect(result).not.toBeNull()
    expect(result?.errorType).toBe('SystemExit')
    expect(result?.matched).toBe(false)
    expect(result?.rawMessage).toBe('1')
  })
})
