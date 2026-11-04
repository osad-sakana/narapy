import { describe, expect, it } from 'vitest'
import { buildOgpTags, OGP_IMAGE_PATH } from './ogpMeta'

describe('buildOgpTags', () => {
  it('SITE_URL が未設定なら何も出さない（絶対URLが必要な og:image / og:url を省く）', () => {
    expect(buildOgpTags(undefined)).toBe('')
    expect(buildOgpTags('')).toBe('')
    expect(buildOgpTags('   ')).toBe('')
  })

  it('og:url と og:image・twitter:image を絶対URLで出す', () => {
    const tags = buildOgpTags('https://example.test')
    expect(tags).toContain('<meta property="og:url" content="https://example.test/" />')
    expect(tags).toContain(`<meta property="og:image" content="https://example.test${OGP_IMAGE_PATH}" />`)
    expect(tags).toContain(`<meta name="twitter:image" content="https://example.test${OGP_IMAGE_PATH}" />`)
  })

  it('末尾スラッシュやパスが付いていても origin だけを使う', () => {
    const tags = buildOgpTags('https://example.test/foo/?x=1')
    expect(tags).toContain('content="https://example.test/"')
    expect(tags).not.toContain('foo')
  })

  it('http(s) 以外のスキームは拒否する', () => {
    expect(() => buildOgpTags('javascript:alert(1)')).toThrow()
    expect(() => buildOgpTags('ftp://example.test')).toThrow()
  })

  it('URL として解釈できない値は拒否する', () => {
    expect(() => buildOgpTags('not a url')).toThrow()
  })
})
