import { describe, it, expect } from 'vitest'
import { diffLines, diffInline, inlineDiffCost } from './diff'

describe('diffLines', () => {
  it('差分がなければ空配列を返す', () => {
    expect(diffLines('a\nb\nc', 'a\nb\nc')).toEqual([])
  })

  it('両方空文字列なら空配列を返す', () => {
    expect(diffLines('', '')).toEqual([])
  })

  it('baselineが空文字列ならmodifiedを返す', () => {
    expect(diffLines('', 'a')).toEqual([
      { kind: 'modified', line: 1, baselineText: '', currentText: 'a' },
    ])
  })

  it('currentが空文字列ならmodifiedを返す', () => {
    expect(diffLines('a', '')).toEqual([
      { kind: 'modified', line: 1, baselineText: 'a', currentText: '' },
    ])
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

  it('片側だけが極端に行数が多い場合、n*mが小さくても安全弁が働く', () => {
    // n*m = 25,000 * 1 = 25,000 で MAX_CELLS を大きく下回るが、
    // 合計op数（n+m）は25,000超であり、ガード無しでは残りを全部delとして
    // 積むループが25,000個のオブジェクトを生成してしまう
    const bigA = Array.from({ length: 25_000 }, (_, i) => `line${i}`).join('\n')
    expect(diffLines(bigA, 'X')).toEqual([])
  })

  it('大きなファイルでも変更が局所的なら共通の先頭・末尾を除いて安全弁に抵触しない', () => {
    const lines = Array.from({ length: 2100 }, (_, i) => `line${i}`)
    const baseline = lines.join('\n')
    const changed = [...lines]
    changed[1050] = 'CHANGED'
    const current = changed.join('\n')
    // トリム無しなら 2100*2100 > MAX_CELLS で安全弁に抵触するが、
    // 共通の先頭1050行・末尾1049行を除けば1行同士の比較で済む
    expect(diffLines(baseline, current)).toEqual([
      { kind: 'modified', line: 1051, baselineText: 'line1050', currentText: 'CHANGED' },
    ])
  })
})

describe('diffInline', () => {
  it('両方空文字列なら空配列を返す', () => {
    expect(diffInline('', '')).toEqual([])
  })

  it('baselineが空文字列ならrangeを返す', () => {
    expect(diffInline('', 'a')).toEqual([
      { kind: 'range', start: 1, end: 2 },
    ])
  })

  it('currentが空文字列ならdeletionMarkerを返す', () => {
    expect(diffInline('a', '')).toEqual([
      { kind: 'deletionMarker', column: 1 },
    ])
  })

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

  it('片側だけが極端に長い場合、n*mが小さくても安全弁が働く', () => {
    // n*m = 200,000 * 1 = 200,000 で MAX_INLINE_CELLS ちょうど（超過しない）だが、
    // 合計op数（n+m）は20万超であり、ガード無しでは残りを全部delとして
    // 積むループが20万個のオブジェクトを生成してしまう
    expect(diffInline('x'.repeat(200_000), 'y')).toEqual([
      { kind: 'range', start: 1, end: 2 },
    ])
  })

  it('長い行でも変更が局所的なら共通の先頭・末尾を除いて安全弁に抵触しない', () => {
    const prefix = 'x'.repeat(300)
    const suffix = 'y'.repeat(300)
    // トリム無しなら 600*600 > MAX_INLINE_CELLS で行全体フォールバックになるが、
    // 共通の先頭・末尾を除けば1文字同士の比較で済む
    expect(diffInline(`${prefix}A${suffix}`, `${prefix}B${suffix}`)).toEqual([
      { kind: 'range', start: 301, end: 302 },
    ])
  })
})

describe('inlineDiffCost', () => {
  it('共通の先頭・末尾を控除した実質コストを返す', () => {
    // トリム後は 'A' vs 'B' の1文字同士（n=m=1）。n*m + n + m = 1 + 1 + 1 = 3
    expect(inlineDiffCost('xxAyy', 'xxByy')).toBe(3)
  })

  it('完全一致なら0を返す', () => {
    expect(inlineDiffCost('same', 'same')).toBe(0)
  })

  it('共通部分が無ければ元の長さから n*m + n + m で計算する', () => {
    // n=m=3。 3*3 + 3 + 3 = 15
    expect(inlineDiffCost('abc', 'XYZ')).toBe(15)
  })

  it('挿入のみ・削除のみ（片側がトリムで0に縮む）でも0にならない', () => {
    // n*mだけで見積もると常に0になり、computeEditOpsが実際に行うO(n+m)の
    // オブジェクト生成が予算に反映されない（回帰テスト）
    expect(inlineDiffCost('', 'a'.repeat(1000))).toBeGreaterThan(0)
    expect(inlineDiffCost('a'.repeat(1000), '')).toBeGreaterThan(0)
  })
})
