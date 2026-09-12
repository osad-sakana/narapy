import * as monaco from 'monaco-editor'
import type { EditorInstance } from '../editor/index'

export interface StepDecorations {
  set: (line: number) => void
  clear: () => void
}

// ステップ実行中の現在行をハイライトする。講師モードの差分装飾（instructor/decorations.ts）
// とは別のコレクションを使うことで、両モードが同時にONでも装飾同士が競合しない。
export function createStepDecorations(editor: EditorInstance): StepDecorations {
  const collection = editor.createDecorationsCollection([])

  function set(line: number): void {
    collection.set([{
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'step-current-line',
        linesDecorationsClassName: 'step-current-gutter',
      },
    }])
    editor.revealLineInCenterIfOutsideViewport(line)
  }

  function clear(): void {
    collection.set([])
  }

  return { set, clear }
}
