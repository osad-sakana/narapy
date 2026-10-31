// コード中の import 文から、最上位のモジュール名を拾う。
// 補完中のコードは構文エラーになりやすい（`np.` など）ため、ast ではなく行単位の正規表現で読む。
// 拾った名前は Pyodide のパッケージ読み込みに渡すので、識別子の形のものだけを返す

export const MAX_IMPORTED_MODULES = 20

const IDENTIFIER = /^[A-Za-z_]\w*$/
const IMPORT_LINE = /^\s*import\s+([^#;]+)/
const FROM_LINE = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\b/

function topLevelName(dotted: string): string | null {
  const name = dotted.trim().split('.')[0]
  return IDENTIFIER.test(name) ? name : null
}

function namesInLine(line: string, typing: boolean): string[] {
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
export function extractImportedModules(code: string, typingLine?: number): string[] {
  const found = new Set<string>()
  const lines = code.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    for (const name of namesInLine(lines[i], typingLine === i + 1)) {
      found.add(name)
      if (found.size >= MAX_IMPORTED_MODULES) return [...found]
    }
  }
  return [...found]
}
