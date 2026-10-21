import type { RunFile } from '../types'

// 行頭（インデント可）の import 文だけを対象にする（コメント・文字列中を誤検出しない。detect.ts と同じ方針）。
// 共有リンクで開いた任意の .py にも毎回かかるため、隣り合う量指定子が同じ文字を取り合う形
// （`[ \\t]+` と `[^#\\n]*` など）を避け、長い 1 行でも線形時間で終わるようにしている。
const IMPORT_STMT = /^[ \t]*import[ \t]([^#\n]+)/gm
// `from pkg import (` の括弧の中身は、正規表現ではなく下の関数で上限つきに切り出す
// （閉じ括弧の無い行が大量にあっても、正規表現のバックトラックで固まらないように）
const FROM_IMPORT_STMT = /^[ \t]*from[ \t]+(\.*\w[\w.]*|\.+)[ \t]+import[ \t]*(\(?)([^#\n]*)/gm
const MAX_PAREN_LIST_CHARS = 2000

export interface ImportRef {
  // 相対 import のドットの数（絶対 import は 0）
  level: number
  // ドット区切りのモジュール名（`from . import x` のように名前が無いときは import した名前）
  name: string
}

function splitNames(list: string): string[] {
  return list
    .replace(/[()]/g, ' ')
    .split(',')
    .map((part) => part.trim().split(/\s/)[0])
    .filter((name) => /^[\w.]+$/.test(name))
}

// from import の名前の並び。括弧つき（複数行）なら、閉じ括弧までを上限つきで取り込む
function importedNameList(code: string, match: RegExpMatchArray): string {
  const [whole, , paren, firstLine] = match
  if (!paren) return firstLine
  // 同じ行で閉じていれば、後続の行は別の文
  if (firstLine.includes(')')) return firstLine.split(')')[0]
  const rest = code.slice(match.index! + whole.length, match.index! + whole.length + MAX_PAREN_LIST_CHARS)
  const close = rest.indexOf(')')
  return close < 0 ? firstLine : firstLine + rest.slice(0, close)
}

// コードが import しうるモジュール。`from pkg import x` の x はサブモジュールの可能性があるので
// `pkg.x` も候補に含める。
export function importedModules(source: string): ImportRef[] {
  // `import os; import game` のように 1 行に複数の文がある場合も拾うため、`;` を改行として扱う
  // （文字列中の `;` で行が増えても、候補が増えるだけで害はない）
  const code = source.replace(/;/g, '\n')
  const refs: ImportRef[] = []
  for (const match of code.matchAll(IMPORT_STMT)) {
    for (const name of splitNames(match[1])) refs.push({ level: 0, name })
  }
  for (const match of code.matchAll(FROM_IMPORT_STMT)) {
    const level = match[1].length - match[1].replace(/^\.+/, '').length
    const module = match[1].slice(level)
    if (module) refs.push({ level, name: module })
    const list = importedNameList(code, match).replace(/#[^\n]*/g, '')
    for (const name of splitNames(list)) {
      refs.push({ level, name: module ? `${module}.${name}` : name })
    }
  }
  return refs
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? '' : path.slice(0, idx)
}

function join(base: string, path: string): string {
  return base ? `${base}/${path}` : path
}

// モジュール参照に対応するファイルパスの候補（a.b → a.py / a/__init__.py / a/b.py / a/b/__init__.py）。
// 絶対 import はプロジェクトのルート基準、相対 import は import 元ファイルのパッケージ基準で、
// level - 1 個ぶん親ディレクトリへ上る。
function candidatePaths(ref: ImportRef, importerDir: string): string[] {
  let base = ''
  if (ref.level > 0) {
    base = importerDir
    for (let i = 1; i < ref.level; i++) base = dirname(base)
  }
  const parts = ref.name.split('.')
  return parts.flatMap((_, i) => {
    const path = join(base, parts.slice(0, i + 1).join('/'))
    return [`${path}.py`, `${path}/__init__.py`]
  })
}

// エントリのコード（複数可）から import を再帰的に辿り、到達するテキスト .py ファイルの内容を返す。
// pygame を使うかの判定を、エディタの表示中ファイルだけでなく import 先まで広げるために使う。
export function collectImportedSources(
  roots: readonly string[],
  files: readonly RunFile[],
): string[] {
  const textFiles = new Map<string, string>()
  for (const file of files) {
    if (file.kind === 'text' && file.path.endsWith('.py')) textFiles.set(file.path, file.data)
  }

  const visited = new Set<string>()
  const sources: string[] = []
  // エントリ（エディタの内容）はルート直下のファイル扱い
  const queue = roots.map((code) => ({ code, dir: '' }))
  while (queue.length > 0) {
    const { code, dir } = queue.shift() as { code: string; dir: string }
    for (const ref of importedModules(code)) {
      for (const path of candidatePaths(ref, dir)) {
        const data = textFiles.get(path)
        if (data === undefined || visited.has(path)) continue
        visited.add(path)
        sources.push(data)
        queue.push({ code: data, dir: dirname(path) })
      }
    }
  }
  return sources
}
