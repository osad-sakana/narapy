import type { RunFile } from '../types'

// 行頭（インデント可）の import 文だけを対象にする（コメント・文字列中を誤検出しない。detect.ts と同じ方針）。
// 共有リンクで開いた任意の .py にも毎回かかるため、隣り合う量指定子が同じ文字を取り合う形
// （`[ \\t]+` と `[^#\\n]*` など）を避け、長い 1 行でも線形時間で終わるようにしている。
const IMPORT_STMT = /^[ \t]*import[ \t]([^#\n]+)/gm
const FROM_IMPORT_STMT = /^[ \t]*from[ \t]+(\.*\w[\w.]*|\.+)[ \t]+import[ \t]([^#\n]+)/gm

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

// コードが import しうるモジュール。`from pkg import x` の x はサブモジュールの可能性があるので
// `pkg.x` も候補に含める。
export function importedModules(code: string): ImportRef[] {
  const refs: ImportRef[] = []
  for (const match of code.matchAll(IMPORT_STMT)) {
    for (const name of splitNames(match[1])) refs.push({ level: 0, name })
  }
  for (const match of code.matchAll(FROM_IMPORT_STMT)) {
    const level = match[1].length - match[1].replace(/^\.+/, '').length
    const module = match[1].slice(level)
    if (module) refs.push({ level, name: module })
    for (const name of splitNames(match[2])) {
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
