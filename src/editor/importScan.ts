// コード中の import 文から、最上位のモジュール名を拾う。
// 補完中のコードは構文エラーになりやすい（`np.` など）ため、ast ではなく行単位の正規表現で読む。
// 拾った名前は Pyodide のパッケージ読み込みに渡すので、識別子の形のものだけを返す

// 1 回のコードから拾う名前の上限（巨大なコードで配列が膨らまないようにする）
export const MAX_SCANNED_MODULES = 200
// 1 回の要求で新しく読み込みを始める名前の上限
export const MAX_FRESH_MODULES = 10
// 失敗した名前を再試行するまでの待ち時間（オフライン時に打鍵ごとに通信しない）
export const RETRY_AFTER_MS = 30_000

// 補完のために読み込むパッケージ（import 名）。jedi で補完できることを Pyodide 上で確認したものに限る。
// numpy は jedi が型定義をたどる途中で RecursionError になり、補完のたびに約3.5秒 Worker を塞いで
// 空を返すため含めない（matplotlib は読み込み後に補完できる）。
// 共有リンクで開いたコードが任意の大きなパッケージを読み込ませることも防ぐ
const COMPLETION_PACKAGES: ReadonlySet<string> = new Set(['pygame', 'matplotlib'])

const IDENTIFIER = /^[A-Za-z_]\w*$/
const IMPORT_LINE = /^\s*import\s+([^#]+)/
const FROM_LINE = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\b/

function topLevelName(dotted: string): string | null {
  const name = dotted.trim().split('.')[0]
  return IDENTIFIER.test(name) ? name : null
}

function namesInStatement(line: string, typing: boolean): string[] {
  const from = FROM_LINE.exec(line)
  if (from) {
    const name = topLevelName(from[1])
    return name ? [name] : []
  }
  // 入力中の行の `import nu` は途中の綴りなので拾わない（`from x import` はモジュール名が確定している）
  if (typing) return []
  const imp = IMPORT_LINE.exec(line)
  if (!imp) return []
  return imp[1]
    .split(',')
    .map((part) => topLevelName(part.trim().split(/\s+as\s+/)[0]))
    .filter((name): name is string => name !== null)
}

// typingLine: カーソルがある行（1始まり）。入力途中の `import` 行を除外するために使う
function namesInLine(line: string, typing: boolean): string[] {
  // `import os; import numpy` のようにセミコロンで続く文も読む
  return line.split(';').flatMap((statement) => namesInStatement(statement, typing))
}

export function extractImportedModules(code: string, typingLine?: number): string[] {
  const found = new Set<string>()
  const lines = code.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    for (const name of namesInLine(lines[i], typingLine === i + 1)) {
      found.add(name)
      if (found.size >= MAX_SCANNED_MODULES) return [...found]
    }
  }
  return [...found]
}

// 名前 → 次に読み込みを試してよい時刻（ms）。読み込み中・成功は Infinity、失敗は再試行できる時刻
export type RequestedModules = ReadonlyMap<string, number>

// これから読み込みを始める名前を選ぶ。上限は「新しく読む名前」にだけ適用する
export function selectFreshModules(
  code: string,
  typingLine: number,
  requested: RequestedModules,
  now: number,
): string[] {
  return extractImportedModules(code, typingLine)
    .filter((name) => COMPLETION_PACKAGES.has(name) && (requested.get(name) ?? 0) <= now)
    .slice(0, MAX_FRESH_MODULES)
}
