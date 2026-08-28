import * as monaco from 'monaco-editor'
import { diffLines, diffInline } from './diff'

// modified行1件あたりのdiffInlineコストは行diffのMAX_INLINE_CELLSで抑えられているが、
// 一度の再計算でmodified行が大量にある場合（大きな貼り付け等）にコストが積み上がるのを防ぐため、
// 1回の buildDecorations 呼び出し全体でも予算を設ける。超過後は文字単位を諦め、
// 該当行は行全体のハイライトのみにフォールバックする（安全側）。
const MAX_TOTAL_INLINE_COST = 2_000_000

// 講師モードの差分をMonacoの装飾（IModelDeltaDecoration）へ変換する。
// 装飾コレクションの張り替えは呼び出し側（controller.ts）が行い、この関数は
// baseline/current の2つの全文からエディタ非依存の diff.ts を経由して装飾配列を組み立てるだけ。
export function buildDecorations(baselineText: string, currentText: string): monaco.editor.IModelDeltaDecoration[] {
  const lineChanges = diffLines(baselineText, currentText)
  // String.split('\n') は空文字列に対しても [''] を返すため、行数は常に1以上になる
  const totalLines = currentText.split('\n').length

  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  let inlineCostUsed = 0

  for (const change of lineChanges) {
    if (change.kind === 'added') {
      decorations.push(wholeLineDecoration(change.line, 'diff-gutter'))
    } else if (change.kind === 'deletedAt') {
      // ファイル末尾での削除は行数+1になりうるため、最終行のガターへ丸める
      const line = Math.min(change.line, totalLines)
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: { linesDecorationsClassName: 'diff-deleted-gutter' },
      })
    } else {
      decorations.push(wholeLineDecoration(change.line, 'diff-gutter'))
      inlineCostUsed += change.baselineText.length * change.currentText.length
      if (inlineCostUsed > MAX_TOTAL_INLINE_COST) continue
      for (const inline of diffInline(change.baselineText, change.currentText)) {
        decorations.push(inlineDecoration(change.line, inline))
      }
    }
  }

  return decorations
}

function wholeLineDecoration(line: number, gutterClassName: string): monaco.editor.IModelDeltaDecoration {
  return {
    range: new monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      className: 'diff-line',
      linesDecorationsClassName: gutterClassName,
    },
  }
}

function inlineDecoration(
  line: number,
  inline: ReturnType<typeof diffInline>[number],
): monaco.editor.IModelDeltaDecoration {
  if (inline.kind === 'deletionMarker') {
    return {
      range: new monaco.Range(line, inline.column, line, inline.column),
      options: { beforeContentClassName: 'diff-inline-deleted' },
    }
  }
  return {
    range: new monaco.Range(line, inline.start, line, inline.end),
    options: { className: 'diff-inline' },
  }
}
