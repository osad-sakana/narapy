import * as monaco from 'monaco-editor'
import type { EditorInstance } from '../editor/index'
import { requestLint } from '../editor/completion'
import { decideLintApply } from './decide'
import { toMarkers } from './markers'
import { toLogLine, type MissingCallWarning } from './result'

const MARKER_OWNER = 'narapy.missingCall'
// 入力のたびに解析しないよう、入力が止まってから検査する
const DEBOUNCE_MS = 500
// 補完 Worker の起動（Pyodide・jedi の読み込み）を待つ間は timeout / unavailable になるので、
// 内容が変わっていなければ間隔をあけて検査し直す
const RETRY_MS = 2000
const MAX_RETRIES = 6

export interface MissingCallLintDeps {
  readonly editor: EditorInstance
  readonly getEditorPath: () => string
  // 講師モードなど、警告を出さない状態か
  readonly isSuppressed: () => boolean
}

export interface MissingCallLint {
  // 講師モードの切替時に呼ぶ。ON なら全ファイルの波線を消し、OFF なら検査し直す
  onSuppressedChanged: () => void
  // 実行ログに出す警告。検査結果が現在の内容と一致しているときだけ返す
  getRunWarnings: () => readonly string[]
}

interface Cache {
  readonly model: monaco.editor.ITextModel
  readonly version: number
  readonly warnings: readonly MissingCallWarning[]
}

export function initMissingCallLint({ editor, getEditorPath, isSuppressed }: MissingCallLintDeps): MissingCallLint {
  let timer: ReturnType<typeof setTimeout> | null = null
  let cache: Cache | null = null
  let retries = 0

  const clearMarkers = (model: monaco.editor.ITextModel): void => {
    monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
  }

  const check = async (): Promise<void> => {
    const model = editor.getModel()
    if (!model) return
    if (isSuppressed() || !getEditorPath().endsWith('.py')) {
      cache = null
      clearMarkers(model)
      return
    }

    const sentVersion = model.getVersionId()
    const result = await requestLint(model.getValue())
    if (result.status === 'superseded') return

    const decision = decideLintApply({
      sameModel: editor.getModel() === model,
      sentVersion,
      currentVersion: model.getVersionId(),
      suppressed: isSuppressed(),
      isPython: getEditorPath().endsWith('.py'),
    })
    if (decision === 'stale') return
    if (decision === 'clear' || result.status !== 'ok') {
      cache = null
      clearMarkers(model)
      if (decision === 'apply' && (result.status === 'timeout' || result.status === 'unavailable') && retries < MAX_RETRIES) {
        retries += 1
        arm(RETRY_MS)
      }
      return
    }
    cache = { model, version: sentVersion, warnings: result.warnings }
    monaco.editor.setModelMarkers(model, MARKER_OWNER, toMarkers(result.warnings, monaco.MarkerSeverity.Warning))
  }

  const arm = (delayMs: number): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void check()
    }, delayMs)
  }

  const runNow = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    void check()
  }

  editor.onDidChangeModelContent(() => {
    retries = 0
    arm(DEBOUNCE_MS)
  })
  editor.onDidChangeModel(() => {
    retries = 0
    runNow()
  })
  runNow()

  return {
    onSuppressedChanged() {
      if (isSuppressed()) {
        if (timer) clearTimeout(timer)
        timer = null
        cache = null
        monaco.editor.getModels().forEach(clearMarkers)
      } else {
        retries = 0
        runNow()
      }
    },

    getRunWarnings() {
      const model = editor.getModel()
      if (isSuppressed() || !model || !cache) return []
      if (cache.model !== model || cache.version !== model.getVersionId()) return []
      return cache.warnings.map(toLogLine)
    },
  }
}
