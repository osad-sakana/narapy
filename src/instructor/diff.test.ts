import { describe, it, expect } from 'vitest'
import { diffLines, diffInline } from './diff'

describe('diffLines', () => {
  it('差分がなければ空配列を返す', () => {
    expect(diffLines('a\nb\nc', 'a\nb\nc')).toEqual([])
  })

  it('末尾に行が追加された場合はaddedを返す', () => {
    expect(diffLines('a\nb', 'a\nb\nc')).toEqual([
      { kind: 'added', line: 3 },
    ])
  })

  it('先頭に行が追加された場合はaddedを返す', () => {
    expect(diffLines('b\nc', 'a\nb\nc')).toEqual([
      { kind: 'added', line: 1 },
    ])
  })

  it('1行が書き換わった場合はmodifiedを返す', () => {
    expect(diffLines('a\nb\nc', 'a\nX\nc')).toEqual([
      { kind: 'modified', line: 2, baselineText: 'b', currentText: 'X' },
    ])
  })

  it('行が削除された場合はdeletedAtを返す', () => {
    expect(diffLines('a\nb\nc', 'a\nc')).toEqual([
      { kind: 'deletedAt', line: 2 },
    ])
  })

  it('ファイル末尾の行が削除された場合、行番号は行数+1になる', () => {
    expect(diffLines('a\nb\nc', 'a\nb')).toEqual([
      { kind: 'deletedAt', line: 3 },
    ])
  })

  it('削除数が追加数より多いブロックは、超過分を1件のdeletedAtにまとめる', () => {
    // baseline: a,b,c,d / current: a,X,d → b,cが削除されXが追加された1ブロック
    expect(diffLines('a\nb\nc\nd', 'a\nX\nd')).toEqual([
      { kind: 'modified', line: 2, baselineText: 'b', currentText: 'X' },
      { kind: 'deletedAt', line: 3 },
    ])
  })

  it('追加数が削除数より多いブロックは、超過分を個別のaddedにする', () => {
    // baseline: a,b,d / current: a,X,Y,Z,d → bが削除されX,Y,Zが追加された1ブロック
    expect(diffLines('a\nb\nd', 'a\nX\nY\nZ\nd')).toEqual([
      { kind: 'modified', line: 2, baselineText: 'b', currentText: 'X' },
      { kind: 'added', line: 3 },
      { kind: 'added', line: 4 },
    ])
  })

  it('離れた変更は別々のエントリになる', () => {
    expect(diffLines('a\nb\nc\nd\ne', 'X\nb\nc\nd\nY')).toEqual([
      { kind: 'modified', line: 1, baselineText: 'a', currentText: 'X' },
      { kind: 'modified', line: 5, baselineText: 'e', currentText: 'Y' },
    ])
  })

  it('n*mがMAX_CELLSを超える場合は空配列を返す（安全弁）', () => {
    const bigA = Array.from({ length: 2100 }, (_, i) => `line${i}`).join('\n')
    const bigB = Array.from({ length: 2100 }, (_, i) => `line${i}-x`).join('\n')
    // 2100 * 2100 = 4,410,000 > 4,000,000
    expect(diffLines(bigA, bigB)).toEqual([])
  })
})

describe('diffInline', () => {
  it('末尾への追加はrangeを返す', () => {
    expect(diffInline('foo', 'foobar')).toEqual([
      { kind: 'range', start: 4, end: 7 },
    ])
  })

  it('先頭への追加はrangeを返す', () => {
    expect(diffInline('bar', 'foobar')).toEqual([
      { kind: 'range', start: 1, end: 4 },
    ])
  })

  it('中間の書き換えはrangeを返す', () => {
    expect(diffInline('foo bar', 'foo BAZ')).toEqual([
      { kind: 'range', start: 5, end: 8 },
    ])
  })

  it('挿入を伴わない純粋な削除は幅ゼロのdeletionMarkerを返す', () => {
    expect(diffInline('foobar', 'foo')).toEqual([
      { kind: 'deletionMarker', column: 4 },
    ])
  })

  it('サロゲートペア（絵文字）を含む行でも正しい列を返す', () => {
    // '🐍' はサロゲートペア（UTF-16で2コードユニット）
    expect(diffInline('a🐍b', 'aXb')).toEqual([
      { kind: 'range', start: 2, end: 3 },
    ])
  })

  it('差分がなければ空配列を返す', () => {
    expect(diffInline('same', 'same')).toEqual([])
  })

  it('n*mがMAX_INLINE_CELLSを超える場合は行全体を1つの変更範囲にフォールバックする', () => {
    const longA = 'a'.repeat(500)
    const longB = 'b'.repeat(500)
    // 500 * 500 = 250,000 > 200,000
    expect(diffInline(longA, longB)).toEqual([
      { kind: 'range', start: 1, end: 501 },
    ])
  })
})
