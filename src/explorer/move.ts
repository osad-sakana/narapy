import { getBasename, getDirname } from './paths'

export interface MoveSource {
  type: 'file' | 'dir'
  path: string
}

export interface MoveSnapshot {
  files: readonly string[]
  directories: readonly string[]
}

export interface PathMove {
  from: string
  to: string
}

export type MoveFailure = 'same' | 'into-self' | 'conflict' | 'not-found'

export type MovePlan =
  | { ok: true; fileMoves: PathMove[]; dirMoves: PathMove[] }
  | { ok: false; reason: MoveFailure }

function joinDir(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name
}

// ファイル・フォルダを destDir（ルートは空文字）へ移す計画を立てる。副作用なし。
// フォルダは配下のファイルとサブフォルダをまとめて移す。同名の項目がある移動先へは
// 上書き・マージせず conflict にする（内容を失わないため）。
export function planMove(snapshot: MoveSnapshot, source: MoveSource, destDir: string): MovePlan {
  const exists = source.type === 'file'
    ? snapshot.files.includes(source.path)
    : snapshot.directories.includes(source.path)
  if (!exists) return { ok: false, reason: 'not-found' }

  if (source.type === 'dir' && (destDir === source.path || destDir.startsWith(`${source.path}/`))) {
    return { ok: false, reason: 'into-self' }
  }
  if (getDirname(source.path) === destDir) return { ok: false, reason: 'same' }

  const to = joinDir(destDir, getBasename(source.path))
  if (snapshot.files.includes(to) || snapshot.directories.includes(to)) {
    return { ok: false, reason: 'conflict' }
  }

  if (source.type === 'file') {
    return { ok: true, fileMoves: [{ from: source.path, to }], dirMoves: [] }
  }

  // 前方一致だけの別フォルダ（data と data2）を巻き込まないよう、末尾に / を付けて判定する
  const prefix = `${source.path}/`
  const rebase = (path: string): string => to + path.slice(source.path.length)
  return {
    ok: true,
    fileMoves: snapshot.files.filter(p => p.startsWith(prefix)).map(p => ({ from: p, to: rebase(p) })),
    dirMoves: snapshot.directories
      .filter(p => p === source.path || p.startsWith(prefix))
      .map(p => ({ from: p, to: rebase(p) })),
  }
}
