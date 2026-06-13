// Pyodide CDN URL とハッシュは両 Worker から参照するため一元管理する。
// バージョンを上げる際はここだけ更新すればよい。
export const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'
export const PYODIDE_MJS_HASH = 'sha384-99NUXWQ/+GiMxiBXXMq7KS8/e2HFz84pdM4eSR3j9E5Nmqxwv8jiOmm36bKkIGTL'

// CDN ファイルを取得して SHA-384 ハッシュを検証してからインポートする。
// 標準 SRI は Workers の dynamic import() に適用されないため手動で検証する。
//
// Blob URL を import() する手法は crossOriginIsolated（COOP/COEP require-corp）下では
// ブラウザにブロックされるため使えない。代わりに force-cache で fetch して検証し、
// 同一 URL を直接 import() することで HTTP キャッシュ上の検証済みバイトを再利用する。
export async function verifiedImport(url: string, expectedHash: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`fetch failed: ${url} (${response.status})`)

  const buffer = await response.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-384', buffer)
  const hashBase64 = btoa(
    Array.from(new Uint8Array(hashBuffer), (b) => String.fromCharCode(b)).join(''),
  )
  const actual = `sha384-${hashBase64}`
  if (actual !== expectedHash) throw new Error(`SRI mismatch: expected ${expectedHash}, got ${actual}`)

  return await import(/* @vite-ignore */ url)
}
