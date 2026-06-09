// Pyodide CDN URL とハッシュは両 Worker から参照するため一元管理する。
// バージョンを上げる際はここだけ更新すればよい。
export const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'
export const PYODIDE_MJS_HASH = 'sha384-99NUXWQ/+GiMxiBXXMq7KS8/e2HFz84pdM4eSR3j9E5Nmqxwv8jiOmm36bKkIGTL'

// CDN ファイルを取得して SHA-384 ハッシュを検証し、Blob URL 経由でインポートする。
// 標準 SRI は Workers の dynamic import() に適用されないため手動で検証する。
export async function verifiedImport(url: string, expectedHash: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`fetch failed: ${url} (${response.status})`)

  const buffer = await response.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-384', buffer)
  const hashBase64 = btoa(
    Array.from(new Uint8Array(hashBuffer), (b) => String.fromCharCode(b)).join(''),
  )
  const actual = `sha384-${hashBase64}`
  if (actual !== expectedHash) throw new Error(`SRI mismatch: expected ${expectedHash}, got ${actual}`)

  const blob = new Blob([buffer], { type: 'text/javascript' })
  const blobUrl = URL.createObjectURL(blob)
  try {
    return await import(/* @vite-ignore */ blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}
