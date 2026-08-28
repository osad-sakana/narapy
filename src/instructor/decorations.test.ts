import { describe, it, expect, vi } from 'vitest'

// environment: 'node' では monaco-editor 本体（DOM依存）を読み込めないため、
// decorations.ts が使う Range だけを最小限のフェイクに差し替える
vi.mock('monaco-editor', () => ({
  Range: class {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
    constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
      this.startLineNumber = startLineNumber
      this.startColumn = startColumn
      this.endLineNumber = endLineNumber
      this.endColumn = endColumn
    }
  },
}))

const { buildDecorations } = await import('./decorations')

describe('buildDecorations', () => {
  it('追加行には全行背景とガターの装飾が付く', () => {
    const decorations = buildDecorations('a\nb', 'a\nb\nc')
    expect(decorations).toEqual([
      {
        range: expect.objectContaining({ startLineNumber: 3, endLineNumber: 3 }),
        options: expect.objectContaining({ isWholeLine: true, className: 'diff-line', linesDecorationsClassName: 'diff-gutter' }),
      },
    ])
  })

  it('削除位置には全行背景を付けずガターのみ付く', () => {
    const decorations = buildDecorations('a\nb\nc', 'a\nc')
    expect(decorations).toEqual([
      {
        range: expect.objectContaining({ startLineNumber: 2, endLineNumber: 2 }),
        options: { linesDecorationsClassName: 'diff-deleted-gutter' },
      },
    ])
  })

  it('ファイル末尾での削除は最終行のガターへ丸められる', () => {
    const decorations = buildDecorations('a\nb\nc', 'a\nb')
    expect(decorations).toHaveLength(1)
    expect(decorations[0].range).toEqual(expect.objectContaining({ startLineNumber: 2, endLineNumber: 2 }))
    expect(decorations[0].options).toEqual({ linesDecorationsClassName: 'diff-deleted-gutter' })
  })

  it('変更行には全行背景・ガターに加えてインライン変更範囲の装飾が付く', () => {
    const decorations = buildDecorations('a\nbbb\nc', 'a\nbXb\nc')
    expect(decorations).toEqual([
      expect.objectContaining({
        range: expect.objectContaining({ startLineNumber: 2 }),
        options: expect.objectContaining({ className: 'diff-line' }),
      }),
      {
        range: expect.objectContaining({ startLineNumber: 2, startColumn: 2, endColumn: 3 }),
        options: { className: 'diff-inline' },
      },
    ])
  })

  it('挿入を伴わない純粋な削除はbeforeContentClassNameの幅ゼロマーカーになる', () => {
    const decorations = buildDecorations('a\nfoobar\nc', 'a\nfoo\nc')
    const marker = decorations.find(d => d.options.beforeContentClassName)
    expect(marker).toBeDefined()
    expect(marker?.range).toEqual(expect.objectContaining({ startColumn: 4, endColumn: 4 }))
    expect(marker?.options).toEqual({ beforeContentClassName: 'diff-inline-deleted' })
  })

  it('1回の呼び出し全体でのインラインコスト予算を超えたら、超過分は全行ハイライトのみにフォールバックする', () => {
    // 各行 800 文字 × 800 文字 = 640,000 セル（行単体でMAX_INLINE_CELLS=200,000を超えるため、
    // diffInline自体が既に行全体1件へフォールバックする）。3行分で1,920,000とまだ予算内
    // (MAX_TOTAL_INLINE_COST=2,000,000)だが、4行目で累計が予算を超えるため
    // 4・5行目はインライン装飾を持たない
    const longLine = (ch: string) => ch.repeat(800)
    const baselineLines = Array.from({ length: 5 }, () => longLine('a'))
    const currentLines = Array.from({ length: 5 }, () => longLine('b'))
    const decorations = buildDecorations(baselineLines.join('\n'), currentLines.join('\n'))

    const inlineDecorations = decorations.filter(d => d.options.className === 'diff-inline')
    const wholeLineDecorations = decorations.filter(d => d.options.className === 'diff-line')

    expect(wholeLineDecorations).toHaveLength(5)
    expect(inlineDecorations).toHaveLength(3)
  })

  it('行単体では予算内でも、文字単位diffが累積で総予算を使い切ったら以降の行はフォールバックする', () => {
    // 各行は 400文字×400文字=160,000セルでMAX_INLINE_CELLS(200,000)未満のため、
    // 実際に文字単位のLCSが実行される（行全体フォールバックではない）。
    // 12行分の累計は 1,920,000 で予算内(2,000,000)だが、13行目で2,080,000を超える
    const longLine = (ch: string) => ch.repeat(400)
    const baselineLines = Array.from({ length: 15 }, () => longLine('x'))
    const currentLines = Array.from({ length: 15 }, () => longLine('y'))
    const decorations = buildDecorations(baselineLines.join('\n'), currentLines.join('\n'))

    const inlineDecorations = decorations.filter(d => d.options.className === 'diff-inline')
    const wholeLineDecorations = decorations.filter(d => d.options.className === 'diff-line')

    expect(wholeLineDecorations).toHaveLength(15)
    expect(inlineDecorations).toHaveLength(12)
  })

  it('挿入のみの行が大量にあっても総予算が働く（片側が空の行はn*mでは0課金になる回帰テスト）', () => {
    // 各行はbaseline側が空行なのでn*mでは常に0課金になってしまう（修正前の欠陥）。
    // n+mも合算すると1行あたり100,000で、20行分の累計1,900,000+αで予算(2,000,000)を使い切り、
    // 21行目以降はインライン装飾を持たない
    const baselineLines = Array.from({ length: 25 }, () => '')
    const currentLines = Array.from({ length: 25 }, () => 'y'.repeat(100_000))
    const decorations = buildDecorations(baselineLines.join('\n'), currentLines.join('\n'))

    const inlineDecorations = decorations.filter(d => d.options.className === 'diff-inline')
    const wholeLineDecorations = decorations.filter(d => d.options.className === 'diff-line')

    expect(wholeLineDecorations).toHaveLength(25)
    expect(inlineDecorations).toHaveLength(20)
  })
})
