import * as monaco from 'monaco-editor'
import type { EditorInstance } from './index'

let decorations: monaco.editor.IEditorDecorationsCollection | null = null

export function setErrorHighlight(
  editor: EditorInstance,
  line: number,
  message: string,
): void {
  clearErrorHighlight(editor)

  decorations = editor.createDecorationsCollection([{
    range: new monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      className: 'error-line-highlight',
    },
  }])

  const model = editor.getModel()
  if (model) {
    monaco.editor.setModelMarkers(model, 'runtime', [{
      severity: monaco.MarkerSeverity.Error,
      message,
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: model.getLineMaxColumn(line),
    }])
  }

  editor.revealLineInCenter(line)
}

export function clearErrorHighlight(editor: EditorInstance): void {
  decorations?.clear()
  decorations = null
  const model = editor.getModel()
  if (model) monaco.editor.setModelMarkers(model, 'runtime', [])
}
