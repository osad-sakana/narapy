import { parseNarapyArchive, type NarapyProject } from '../fileio/index'

export const MAX_REMOTE_PROJECT_SIZE = 10 * 1024 * 1024 // 10 MB
export const FETCH_TIMEOUT_MS = 15_000

function sizeLimitMessage(url: string): string {
  return `外部プロジェクトのサイズが上限 (${(MAX_REMOTE_PROJECT_SIZE / 1024 / 1024).toFixed(0)} MB) を超えています: ${url}`
}

// ?project=<URL> で指定された外部の.narapyを取得する(issue #32)。
// 提供元にCORS (Access-Control-Allow-Origin) が必要。
export async function fetchNarapyFromUrl(url: string): Promise<NarapyProject> {
  let response: Response
  try {
    response = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(`外部プロジェクトの取得がタイムアウトしました (${FETCH_TIMEOUT_MS / 1000}秒): ${url}`)
    }
    throw new Error(
      `外部プロジェクトの取得に失敗しました。URL、またはネットワーク/CORS設定 (Access-Control-Allow-Origin) を確認してください: ${url}`,
    )
  }

  if (!response.ok) {
    throw new Error(`外部プロジェクトの取得に失敗しました (HTTP ${response.status}): ${url}`)
  }

  // Content-Lengthで事前に弾く(過大なレスポンスを丸ごとメモリに読み込む前に検知するため)。
  // ヘッダーが無い/偽装されている場合に備え、実際のバイト数でも下でチェックする。
  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REMOTE_PROJECT_SIZE) {
    throw new Error(sizeLimitMessage(url))
  }

  const buf = await response.arrayBuffer()
  if (buf.byteLength > MAX_REMOTE_PROJECT_SIZE) {
    throw new Error(sizeLimitMessage(url))
  }

  try {
    return parseNarapyArchive(new Uint8Array(buf))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`.narapy ファイルの解析に失敗しました: ${message}`)
  }
}
