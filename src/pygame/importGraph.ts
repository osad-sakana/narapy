import type { RunFile } from '../types'

// 行頭（インデント可）の import 文だけを対象にする（コメント・文字列中を誤検出しない。detect.ts と同じ方針）
const IMPORT_STMT = /^[ \t]*import[ \t]+([^#\n]+)/gm
const FROM_IMPORT_STMT = /^[ \t]*from[ \t]+(\.*[\w.]*)[ \t]+import[ \t]+([^#\n]+)/gm

function splitNames(list: string): string[] {
  return list
    .replace(/[()]/g, ' ')
    .split(',')
    .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
    .filter((name) => /^[\w.]+$/.test(name))
}

// コードが import しうるモジュール名（ドット区切り）。`from pkg import x` の x はサブモジュールの
// 可能性があるので `pkg.x` も候補に含める。相対 import は先頭のドットを外して作業ディレクトリ基準で扱う。
export function importedModuleNames(code: string): string[] {
  const names: string[] = []
  for (const match of code.matchAll(IMPORT_STMT)) {
    names.push(...splitNames(match[1]))
  }
  for (const match of code.matchAll(FROM_IMPORT_STMT)) {
    const module = match[1].replace(/^\.+/, '')
    if (module) names.push(module)
    for (const name of splitNames(match[2])) {
      names.push(module ? `${module}.${name}` : name)
    }
  }
  return names
}

// モジュール名に対応するファイルパスの候補（a.b → a.py / a/__init__.py / a/b.py / a/b/__init__.py）
function candidatePaths(moduleName: string): string[] {
  const parts = moduleName.split('.')
  return parts.flatMap((_, i) => {
    const path = parts.slice(0, i + 1).join('/')
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
  const queue = [...roots]
  while (queue.length > 0) {
    const code = queue.shift() as string
    for (const name of importedModuleNames(code)) {
      for (const path of candidatePaths(name)) {
        const data = textFiles.get(path)
        if (data === undefined || visited.has(path)) continue
        visited.add(path)
        sources.push(data)
        queue.push(data)
      }
    }
  }
  return sources
}
