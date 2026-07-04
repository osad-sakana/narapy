export interface UrlLoadParams {
  code?: string
  project?: string
  projectUrl?: string
}

// #code= / #project= はハッシュに埋め込む(サーバーに送信されずCORS不要)。
// ?project=<URL> はクエリ文字列に置き、外部URLから.narapyを取得する(issue #32)。
export function parseUrlLoadParams(
  hash: string = window.location.hash,
  search: string = window.location.search,
): UrlLoadParams {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const params: UrlLoadParams = {}
  const code = hashParams.get('code')
  const project = hashParams.get('project')
  const projectUrl = searchParams.get('project')
  if (code) params.code = code
  if (project) params.project = project
  if (projectUrl) params.projectUrl = projectUrl
  return params
}
