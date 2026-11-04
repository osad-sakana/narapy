// og:image / og:url は絶対URLが必須。公開リポジトリに本番ドメインを書かないため、
// ビルド時に環境変数 SITE_URL（GitHub Variables）から注入する。未設定なら出さない。

export const OGP_IMAGE_PATH = '/og-image.png'

function normalizeSiteOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`SITE_URL が URL として不正です: ${trimmed}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL は http(s) のみ指定できます: ${trimmed}`)
  }
  // パスやクエリは捨てて origin だけ使う（属性値へ任意文字列が入らない）
  return url.origin
}

export function buildOgpTags(siteUrl: string | undefined): string {
  const origin = normalizeSiteOrigin(siteUrl)
  if (origin === null) return ''
  const image = `${origin}${OGP_IMAGE_PATH}`
  return [
    `<meta property="og:url" content="${origin}/" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ')
}
