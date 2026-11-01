import type { NarapyProject } from '../fileio/index'
import type { FileEntry } from '../explorer/types'
import { encodeCodeParam, encodeProjectParam } from '../urlload/encode'

// チャットやメールで途中切れしにくい長さの目安。ブラウザ自体はもっと長いURLを扱えるが、
// 共有先のアプリが切り詰めると壊れたリンクになるため、ここを超えたら作らない。
export const MAX_SHARE_URL_LENGTH = 32_000

export interface ShareState {
  files: FileEntry[]
  directories: { path: string }[]
  activeFile: string
}

export type ShareLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'tooLong'; length: number }
  | { ok: false; reason: 'noTarget' }

export interface ShareTarget {
  path: string
  source: string
}

// 現在のページのオリジン+パス(/make-url の既定値と同じ考え方。クエリ・ハッシュは含めない)
export function currentBaseUrl(loc: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${loc.origin}${loc.pathname}`
}

// 「main.py を共有」の対象。main.py が無ければアクティブなテキストファイル
export function pickCodeTarget(state: ShareState): ShareTarget | undefined {
  const text = (path: string): ShareTarget | undefined => {
    const file = state.files.find(f => f.path === path)
    return file?.content.kind === 'text' ? { path, source: file.content.data } : undefined
  }
  return text('main.py') ?? text(state.activeFile)
}

function finish(base: string, param: string): ShareLinkResult {
  const url = `${base}#${param}`
  return url.length > MAX_SHARE_URL_LENGTH
    ? { ok: false, reason: 'tooLong', length: url.length }
    : { ok: true, url }
}

export function buildCodeLink(base: string, state: ShareState): ShareLinkResult {
  const target = pickCodeTarget(state)
  if (!target) return { ok: false, reason: 'noTarget' }
  return finish(base, `code=${encodeCodeParam(target.source)}`)
}

// 演習メタ(exercise)は含めない。.narapy の保存と同じで、通常のプロジェクトとして共有される
export function buildProjectLink(base: string, state: ShareState): ShareLinkResult {
  const project: NarapyProject = {
    version: 2,
    files: state.files.map(f => ({
      path: f.path,
      content: f.content.kind === 'text'
        ? { kind: 'text', data: f.content.data }
        : { kind: 'binary', data: f.content.data, mime: f.content.mime },
    })),
    directories: state.directories.map(d => ({ path: d.path })),
    activeFile: state.activeFile,
  }
  return finish(base, `project=${encodeProjectParam(project)}`)
}
