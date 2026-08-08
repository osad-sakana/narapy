import { describe, it, expect } from 'vitest'
import { buildErrorIssueUrl } from './issueReport'

function decodeParam(url: string, key: string): string {
  const params = new URL(url).searchParams
  return params.get(key) ?? ''
}

describe('buildErrorIssueUrl', () => {
  it('リポジトリのIssue作成ページを指すURLになる', () => {
    const url = buildErrorIssueUrl({ errorType: 'OverflowError', raw: 'OverflowError: math range error' })
    expect(url.startsWith('https://github.com/osad-sakana/narapy/issues/new?')).toBe(true)
  })

  it('title にエラー種類が入る', () => {
    const url = buildErrorIssueUrl({ errorType: 'OverflowError', raw: 'OverflowError: math range error' })
    expect(decodeParam(url, 'title')).toBe('[未翻訳エラー] OverflowError')
  })

  it('body に元のエラー本文が含まれる', () => {
    const raw = 'Traceback (most recent call last):\nOverflowError: math range error'
    const url = buildErrorIssueUrl({ errorType: 'OverflowError', raw })
    const body = decodeParam(url, 'body')
    expect(body).toContain(raw)
    expect(body).toContain('## 元のエラー')
    expect(body).toContain('## 期待する日本語メッセージ')
  })

  it('改行やバッククォートを含むエラー本文も正しくエンコード・デコードできる', () => {
    const raw = 'SyntaxError: invalid syntax\n    `weird`\n    ^'
    const url = buildErrorIssueUrl({ errorType: 'SyntaxError', raw })
    const body = decodeParam(url, 'body')
    expect(body).toContain(raw)
  })

  it('長いエラー本文は1000文字でtruncateされる', () => {
    const raw = 'x'.repeat(2000)
    const url = buildErrorIssueUrl({ errorType: 'ValueError', raw })
    const body = decodeParam(url, 'body')
    expect(body).toContain('x'.repeat(1000))
    expect(body).not.toContain('x'.repeat(1001))
    expect(body).toContain('…（以下省略）')
  })

  it('1000文字以内のエラー本文はtruncateされない', () => {
    const raw = 'y'.repeat(500)
    const url = buildErrorIssueUrl({ errorType: 'ValueError', raw })
    const body = decodeParam(url, 'body')
    expect(body).toContain(raw)
    expect(body).not.toContain('以下省略')
  })

  it('raw内にコードフェンス（```）が含まれていても脱出せず、より長いフェンスで囲む', () => {
    const raw = '```\n![x](https://evil.example/p.png)\n```'
    const url = buildErrorIssueUrl({ errorType: 'SyntaxError', raw })
    const body = decodeParam(url, 'body')

    const fenceMatch = body.match(/(`{4,})\n([\s\S]*?)\n\1/)
    expect(fenceMatch).not.toBeNull()
    expect(fenceMatch?.[2]).toBe(raw)
  })

  it('日本語主体の1000文字以内のエラー本文でも、URL全体が実用的な長さに収まる', () => {
    const raw = 'あ'.repeat(999)
    const url = buildErrorIssueUrl({ errorType: 'SyntaxError', raw })
    // encodeURIComponentで1文字9バイトに膨れるため、対策前は約9000文字になっていた
    expect(url.length).toBeLessThan(6000)
  })

  it('パーセントエンコード後の長さでも上限が効き、URLが安全な長さに収まる', () => {
    const raw = 'い'.repeat(1000)
    const url = buildErrorIssueUrl({ errorType: 'SyntaxError', raw })
    expect(url.length).toBeLessThan(6000)
    const body = decodeParam(url, 'body')
    expect(body).toContain('以下省略')
  })
})
