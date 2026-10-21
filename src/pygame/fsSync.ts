import type { RunFile } from '../types'

// Pyodide の FS のうち、同期に使う操作だけを抜き出したもの（テストで差し替えやすくするため）
export interface FsLike {
  writeFile: (path: string, data: string | Uint8Array) => void
  mkdir: (path: string) => void
  analyzePath: (path: string) => { exists: boolean }
  unlink: (path: string) => void
}

function ensureDir(fs: FsLike, absPath: string): void {
  let current = ''
  for (const part of absPath.split('/').filter(Boolean)) {
    current += `/${part}`
    if (!fs.analyzePath(current).exists) fs.mkdir(current)
  }
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? '' : path.slice(0, idx)
}

// エクスプローラー上のファイル（画像・フォント・.py 等）を作業ディレクトリへ書き込む。
// メインスレッドの Pyodide は実行をまたいで FS が残るため、前回書いたファイルのうち
// 今回のファイル一覧に無いものは削除する（エクスプローラーで削除したアセットが残らないように）。
// 戻り値は今回書いたファイルの絶対パス集合で、次回の previous に渡す。
export function syncFiles(
  fs: FsLike,
  workDir: string,
  previous: ReadonlySet<string>,
  files: readonly RunFile[],
  directories: readonly string[],
): ReadonlySet<string> {
  const written = new Set(files.map((f) => `${workDir}/${f.path}`))

  for (const path of previous) {
    if (written.has(path)) continue
    try {
      fs.unlink(path)
    } catch {
      // 既に無い・消せない場合は無視する（次の書き込みには影響しない）
    }
  }

  ensureDir(fs, workDir)
  for (const dir of directories) ensureDir(fs, `${workDir}/${dir}`)
  for (const file of files) {
    const dir = dirname(file.path)
    if (dir) ensureDir(fs, `${workDir}/${dir}`)
    fs.writeFile(`${workDir}/${file.path}`, file.data)
  }
  return written
}

// 直下の .py の拡張子抜きモジュール名。sys.path に作業ディレクトリが含まれるため
// `import helper` で参照でき、再実行時に古いモジュールが sys.modules に残らないよう掃除する対象。
export function topLevelPyModuleNames(files: readonly RunFile[]): string[] {
  return files
    .filter((f) => f.kind === 'text' && f.path.endsWith('.py') && !f.path.includes('/'))
    .map((f) => f.path.slice(0, -3))
}
