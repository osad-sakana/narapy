import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, bytesToBase64Url } from './base64url'

describe('bytesToBase64Url / base64UrlToBytes', () => {
  it('空バイト列を往復できる', () => {
    const bytes = new Uint8Array([])
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
  })

  it('任意のバイト列を往復できる', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64, 32])
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
  })

  it('パディングが必要な長さでも往復できる', () => {
    for (const len of [1, 2, 3, 4, 5, 6, 7]) {
      const bytes = new Uint8Array(len).map((_, i) => i)
      expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
    }
  })

  it('URL非安全な文字 (+ / =) を含まない', () => {
    // 0x3e, 0x3f あたりは標準base64だと + / が出やすいバイトパターン
    const bytes = new Uint8Array([0xff, 0xff, 0xfe, 0xfe, 0x3e, 0x3f])
    const encoded = bytesToBase64Url(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
  })
})
