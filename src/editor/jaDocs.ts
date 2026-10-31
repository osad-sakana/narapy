// 初学者向けの日本語説明（組み込み関数・str/list/dict の主なメソッド・random）。
// キーは jedi の full_name。辞書にないものは英語の docstring をそのまま表示する。

export type JaDoc = {
  summary: string
  // 引数名 → 説明
  params?: Readonly<Record<string, string>>
}

const BUILTIN_FUNCTIONS: Readonly<Record<string, JaDoc>> = {
  'builtins.print': {
    summary: '値を画面（実行ログ）に表示します。',
    params: {
      values: '表示する値。カンマで区切って複数渡せます',
      sep: '値と値の間に入れる文字（初期値は半角スペース）',
      end: '最後に付ける文字（初期値は改行）',
      file: '出力先（通常は指定しません）',
      flush: 'True にすると、すぐに出力します',
    },
  },
  'builtins.input': {
    summary: 'キーボードから1行入力を受け取り、文字列で返します。',
    params: { prompt: '入力を求めるときに表示するメッセージ' },
  },
  'builtins.len': {
    summary: '文字列・リストなどの要素の数（長さ）を返します。',
    params: { obj: '長さを調べる文字列・リスト・辞書など' },
  },
  'builtins.range': {
    summary: '連続した整数の並びを作ります。for 文でよく使います。',
    params: {
      start: '開始する値（含む）。省略すると 0',
      stop: '終了する値（含まない）',
      step: '増やす幅。省略すると 1',
    },
  },
  'builtins.int': {
    summary: '値を整数に変換します。',
    params: { x: '変換する値（数値や "123" のような文字列）', base: '何進数の文字列か（初期値は 10）' },
  },
  'builtins.float': { summary: '値を小数（浮動小数点数）に変換します。' },
  'builtins.str': {
    summary: '値を文字列に変換します。',
    params: { o: '変換する値' },
  },
  'builtins.bool': {
    summary: '値を True / False に変換します。',
    params: { o: '変換する値' },
  },
  'builtins.list': {
    summary: 'リストを作ります。他の並び（文字列など）をリストに変換できます。',
    params: { iterable: 'リストにする元の並び' },
  },
  'builtins.dict': { summary: '辞書（キーと値の組）を作ります。' },
  'builtins.tuple': {
    summary: 'タプル（変更できない並び）を作ります。',
    params: { iterable: 'タプルにする元の並び' },
  },
  'builtins.set': {
    summary: '集合（重複のない値の集まり）を作ります。',
    params: { iterable: '集合にする元の並び' },
  },
  'builtins.abs': {
    summary: '絶対値（符号を取った大きさ）を返します。',
    params: { x: '数値' },
  },
  'builtins.max': {
    summary: '最も大きい値を返します。',
    params: {
      arg1: '比べる値',
      arg2: '比べる値',
      _args: '比べる値（さらに続けて渡せます）',
      iterable: '最大値を探す並び（リストなど）',
      key: '大きさを決める基準にする関数',
    },
  },
  'builtins.min': {
    summary: '最も小さい値を返します。',
    params: {
      arg1: '比べる値',
      arg2: '比べる値',
      _args: '比べる値（さらに続けて渡せます）',
      iterable: '最小値を探す並び（リストなど）',
      key: '大きさを決める基準にする関数',
    },
  },
  'builtins.sum': {
    summary: '数値の並びの合計を返します。',
    params: { iterable: '合計する数値の並び（リストなど）', start: '合計に最初に足す値（初期値は 0）' },
  },
  'builtins.round': {
    summary: '数値を四捨五入（偶数丸め）します。',
    params: { number: '丸める数値', ndigits: '小数点以下の桁数。省略すると整数に丸めます' },
  },
  'builtins.sorted': {
    summary: '並べ替えた新しいリストを返します（元の並びは変わりません）。',
    params: {
      iterable: '並べ替える元の並び',
      key: '並べ替えの基準にする関数',
      reverse: 'True にすると大きい順（降順）になります',
    },
  },
  'builtins.reversed': {
    summary: '逆順に取り出せる並びを返します。',
    params: { sequence: '逆順にする元の並び' },
  },
  'builtins.enumerate': {
    summary: '番号と値の組を順に取り出します。for 文で番号が欲しいときに使います。',
    params: { iterable: '元の並び', start: '番号の開始値（初期値は 0）' },
  },
  'builtins.zip': {
    summary: '複数の並びを、同じ位置の値ごとにまとめます。',
    params: {
      iter1: '1つ目の並び',
      iter2: '2つ目の並び',
      iter3: '3つ目の並び',
      iter4: '4つ目の並び',
    },
  },
  'builtins.map': {
    summary: '並びの各要素に関数を適用した結果を返します。',
    params: { func: '各要素に適用する関数', iter1: '元の並び', iter2: '2つ目の並び' },
  },
  'builtins.filter': {
    summary: '条件に合う要素だけを取り出します。',
    params: { function: '条件を判定する関数（True の要素が残ります）', iterable: '元の並び' },
  },
  'builtins.type': {
    summary: '値の型（int や str など）を返します。',
    params: { o: '型を調べる値' },
  },
  'builtins.isinstance': {
    summary: '値が指定した型かどうかを True / False で返します。',
    params: { obj: '調べる値', class_or_tuple: '型（int, str など。タプルで複数指定も可）' },
  },
  'builtins.open': {
    summary: 'ファイルを開きます。with 文と一緒に使うと自動で閉じます。',
    params: {
      file: 'ファイルの名前（パス）',
      mode: '"r"（読む）、"w"（書く）、"a"（追記）など',
      encoding: '文字コード（日本語なら "utf-8" を指定）',
    },
  },
  'builtins.pow': {
    summary: 'べき乗（base の exp 乗）を返します。',
    params: { base: '底', exp: '指数', mod: '指定すると、結果をこの値で割った余りを返します' },
  },
  'builtins.divmod': {
    summary: '割り算の商と余りを組（タプル）で返します。',
    params: { x: '割られる数', y: '割る数' },
  },
  'builtins.chr': {
    summary: '文字コード（整数）に対応する文字を返します。',
    params: { i: '文字コード' },
  },
  'builtins.ord': {
    summary: '文字に対応する文字コード（整数）を返します。',
    params: { c: '1文字の文字列' },
  },
  'builtins.any': {
    summary: '1つでも True があれば True を返します。',
    params: { iterable: '調べる並び' },
  },
  'builtins.all': {
    summary: 'すべてが True なら True を返します。',
    params: { iterable: '調べる並び' },
  },
  'builtins.bin': { summary: '整数を2進数の文字列にします。', params: { number: '整数' } },
  'builtins.hex': { summary: '整数を16進数の文字列にします。', params: { number: '整数' } },
  'builtins.id': { summary: '値の識別番号を返します。', params: { obj: '調べる値' } },
  'builtins.repr': {
    summary: '値を、コードとして読める形の文字列にします。',
    params: { obj: '変換する値' },
  },
  'builtins.format': {
    summary: '書式を指定して値を文字列にします。',
    params: { value: '変換する値', format_spec: '書式（例: ".2f" で小数第2位まで）' },
  },
}

const BUILTIN_METHODS: Readonly<Record<string, JaDoc>> = {
  'builtins.str.upper': { summary: 'すべて大文字にした新しい文字列を返します。' },
  'builtins.str.lower': { summary: 'すべて小文字にした新しい文字列を返します。' },
  'builtins.str.split': {
    summary: '文字列を区切って、リストにします。',
    params: { sep: '区切る文字（省略すると空白で区切ります）', maxsplit: '区切る回数の上限' },
  },
  'builtins.str.join': {
    summary: '文字列のリストを、この文字列でつないで1つにします。',
    params: { iterable: 'つなぐ文字列の並び' },
  },
  'builtins.str.strip': {
    summary: '両端の空白（や指定した文字）を取り除きます。',
    params: { chars: '取り除く文字（省略すると空白と改行）' },
  },
  'builtins.str.replace': {
    summary: '文字列の一部を別の文字列に置き換えた新しい文字列を返します。',
    params: { old: '置き換える前の文字列', new: '置き換えた後の文字列', count: '置き換える回数の上限' },
  },
  'builtins.str.find': {
    summary: '文字列が最初に現れる位置を返します（なければ -1）。',
    params: { sub: '探す文字列', start: '探し始める位置', end: '探し終わる位置' },
  },
  'builtins.str.format': {
    summary: '{} の部分に値を埋め込んだ文字列を返します。',
    params: { args: '順番に埋め込む値', kwargs: '名前を付けて埋め込む値' },
  },
  'builtins.str.startswith': {
    summary: '指定した文字列で始まるかどうかを返します。',
    params: { prefix: '始まりの文字列', start: '調べ始める位置', end: '調べ終わる位置' },
  },
  'builtins.str.endswith': {
    summary: '指定した文字列で終わるかどうかを返します。',
    params: { suffix: '終わりの文字列', start: '調べ始める位置', end: '調べ終わる位置' },
  },
  'builtins.list.append': {
    summary: 'リストの最後に要素を1つ追加します。',
    params: { object: '追加する要素' },
  },
  'builtins.list.remove': {
    summary: '指定した値と等しい最初の要素を削除します。',
    params: { value: '削除する値' },
  },
  'builtins.list.pop': {
    summary: '指定した位置の要素を取り出して削除します。',
    params: { index: '取り出す位置（省略すると最後）' },
  },
  'builtins.list.sort': {
    summary: 'リストをその場で並べ替えます。',
    params: { key: '並べ替えの基準にする関数', reverse: 'True にすると大きい順（降順）' },
  },
  'builtins.list.insert': {
    summary: '指定した位置に要素を挿入します。',
    params: { index: '挿入する位置', object: '挿入する要素' },
  },
  'builtins.list.extend': {
    summary: '別の並びの要素をすべて、リストの最後に追加します。',
    params: { iterable: '追加する要素の並び' },
  },
  'builtins.list.index': {
    summary: '指定した値が最初に現れる位置を返します。',
    params: { value: '探す値', start: '探し始める位置', stop: '探し終わる位置' },
  },
  'builtins.list.count': {
    summary: '指定した値がいくつあるかを返します。',
    params: { value: '数える値' },
  },
  'builtins.dict.keys': { summary: '辞書のキーの一覧を返します。' },
  'builtins.dict.values': { summary: '辞書の値の一覧を返します。' },
  'builtins.dict.items': { summary: '辞書の（キー, 値）の組の一覧を返します。' },
  // typeshed では dict.get が Mapping.get として解決される
  'typing.Mapping.get': {
    summary: 'キーに対応する値を返します（なければ default、省略時は None）。',
    params: { key: '探すキー', default: 'キーがないときに返す値' },
  },
}

const RANDOM_FUNCTIONS: Readonly<Record<string, JaDoc>> = {
  'random.random': { summary: '0 以上 1 未満のランダムな小数を返します。' },
  'random.randint': {
    summary: 'a 以上 b 以下のランダムな整数を返します（b も含まれます）。',
    params: { a: '最小値（含む）', b: '最大値（含む）' },
  },
  'random.randrange': {
    summary: 'range と同じ範囲から、ランダムな整数を返します（stop は含まれません）。',
    params: { start: '開始する値（含む）', stop: '終了する値（含まない）', step: '増やす幅' },
  },
  'random.choice': {
    summary: '並びからランダムに1つ選んで返します。',
    params: { seq: '選ぶ元のリストや文字列' },
  },
  'random.choices': {
    summary: '並びから、重複を許してランダムに k 個選んでリストで返します。',
    params: {
      population: '選ぶ元の並び',
      weights: '選ばれやすさの重み',
      cum_weights: '累積した重み',
      k: '選ぶ個数',
    },
  },
  'random.shuffle': {
    summary: 'リストの順番をその場でランダムに入れ替えます。',
    params: { x: '並べ替えるリスト' },
  },
  'random.sample': {
    summary: '並びから、重複なしでランダムに k 個選んでリストで返します。',
    params: { population: '選ぶ元の並び', k: '選ぶ個数', counts: '各要素の個数' },
  },
  'random.uniform': {
    summary: 'a から b の間のランダムな小数を返します。',
    params: { a: '範囲の端', b: '範囲のもう一方の端' },
  },
  'random.seed': {
    summary: '乱数の種を設定します。同じ種なら同じ乱数の列になります。',
    params: { a: '種にする値（省略すると現在時刻などから自動で決まります）' },
  },
  'random.gauss': {
    summary: '正規分布（ガウス分布）に従うランダムな小数を返します。',
    params: { mu: '平均', sigma: '標準偏差' },
  },
}

const JA_DOCS: Readonly<Record<string, JaDoc>> = {
  ...BUILTIN_FUNCTIONS,
  ...BUILTIN_METHODS,
  ...RANDOM_FUNCTIONS,
}

// random.randint は代入で束ねられたメソッドとして解決されると random.Random.randint になる
const RANDOM_INSTANCE_PREFIX = 'random.Random.'

export function lookupJaDoc(fullName: string): JaDoc | undefined {
  const key = fullName.startsWith(RANDOM_INSTANCE_PREFIX)
    ? `random.${fullName.slice(RANDOM_INSTANCE_PREFIX.length)}`
    : fullName
  return Object.hasOwn(JA_DOCS, key) ? JA_DOCS[key] : undefined
}

// 'sep: Optional[str]=...' や '*values: object' から引数名だけを取り出す
export function paramName(label: string): string {
  const match = /^\s*\**\s*([A-Za-z_]\w*)/.exec(label)
  return match ? match[1] : ''
}

export function lookupJaParam(doc: JaDoc | undefined, paramLabel: string): string | undefined {
  const name = paramName(paramLabel)
  if (!doc?.params || name === '' || !Object.hasOwn(doc.params, name)) return undefined
  return doc.params[name]
}
