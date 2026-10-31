import { KeyMod, KeyCode, editor as monacoEditor } from 'monaco-editor'
import type { EditorInstance } from '../editor/index'
import { requestFormat } from '../editor/completion'
import { appendLog } from '../runner/log'
import { decideApply } from './decide'
import { computeMinimalEdit } from './minimalEdit'
import { formatMessage, type FormatResult } from './result'

const LABEL = '✨ 整形'
const LABEL_BUSY = '準備中…'

export interface FormatControllerDeps {
  readonly editor: EditorInstance
  readonly button: HTMLButtonElement
  readonly getEditorPath: () => string
}

function report(result: FormatResult): void {
  const text = formatMessage(result)
  if (text) appendLog(text, result.status === 'unchanged' ? 'info' : 'warn')
}

export function initFormatController({ editor, button, getEditorPath }: FormatControllerDeps): void {
  let busy = false

  const setBusy = (value: boolean): void => {
    busy = value
    button.disabled = value
    button.textContent = value ? LABEL_BUSY : LABEL
  }

  const format = async (): Promise<void> => {
    const model = editor.getModel()
    const path = getEditorPath()
    if (busy || !model || editor.getOption(monacoEditor.EditorOption.readOnly) || !path.endsWith('.py')) return

    const before = model.getValue()
    const sentVersion = model.getVersionId()
    setBusy(true)
    try {
      const result = await requestFormat(before)
      if (result.status !== 'ok') {
        report(result)
        return
      }
      const decision = decideApply({
        sameModel: editor.getModel() === model,
        sentVersion,
        currentVersion: model.getVersionId(),
        readOnly: editor.getOption(monacoEditor.EditorOption.readOnly),
        path: getEditorPath(),
        before,
        after: result.code,
      })
      if (decision === 'unchanged') report({ status: 'unchanged' })
      if (decision === 'stale') appendLog('整形: 編集またはファイル切替のため中止しました。もう一度お試しください', 'info')
      if (decision !== 'apply') return

      const edit = computeMinimalEdit(before, result.code)
      if (!edit) return
      const start = model.getPositionAt(edit.start)
      const end = model.getPositionAt(edit.end)
      // 前後に undo stop を置き、Ctrl+Z 1回で整形前に戻せるようにする
      editor.pushUndoStop()
      editor.executeEdits('narapy.format', [{
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        text: edit.text,
      }])
      editor.pushUndoStop()
    } finally {
      setBusy(false)
    }
  }

  button.addEventListener('click', () => { void format() })
  editor.addCommand(KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF, () => { void format() })
}
