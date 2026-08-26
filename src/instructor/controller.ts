import type { EditorInstance } from '../editor/index'
import { normalFontProfile, type FontSizeProfile } from '../editor/fontSize'
import {
  getInstructorFontSize,
  setInstructorFontSize,
  INSTRUCTOR_FONT_MIN,
  INSTRUCTOR_FONT_MAX,
  INSTRUCTOR_FONT_STEP,
} from './fontSize'
import { getInstructorEnabled, setInstructorEnabled } from './state'
import { buildDecorations } from './decorations'

// 講義中の打鍵のたびに重い再計算が走らないようデバウンスする
const RECOMPUTE_DEBOUNCE_MS = 500

const instructorFontProfile: FontSizeProfile = {
  get: getInstructorFontSize,
  set: setInstructorFontSize,
  min: INSTRUCTOR_FONT_MIN,
  max: INSTRUCTOR_FONT_MAX,
  step: INSTRUCTOR_FONT_STEP,
}

export interface InstructorControllerDeps {
  editor: EditorInstance
  getEditorPath: () => string
  onStateChange: (isOn: boolean) => void
}

export interface InstructorController {
  isOn: () => boolean
  toggle: () => void
  recordBaseline: () => void
  discardBaseline: () => void
  onContentChanged: () => void
  onActiveFileChanged: (path: string) => void
  fontProfile: () => FontSizeProfile
}

// 講師モードの状態遷移（ON/OFF・基準記録・装飾の張り替え）を管理する。
// 基準スナップショットはメモリのみで保持し、対象ファイルのパスと組にして持つ。
// 現在表示中のファイルが基準記録時と異なる場合は、無意味な全文diffを表示しないよう
// 装飾を消すだけに留める（基準そのものは破棄しない。同じファイルに戻れば再表示される）。
export function createInstructorController(deps: InstructorControllerDeps): InstructorController {
  let isOn = getInstructorEnabled()
  let baseline: { path: string; text: string } | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const decorationsCollection = deps.editor.createDecorationsCollection([])

  function clearDecorations(): void {
    decorationsCollection.set([])
  }

  function recomputeDecorations(): void {
    if (!isOn || !baseline || baseline.path !== deps.getEditorPath()) {
      clearDecorations()
      return
    }
    const currentText = deps.editor.getModel()?.getValue() ?? ''
    decorationsCollection.set(buildDecorations(baseline.text, currentText))
  }

  function toggle(): void {
    isOn = !isOn
    setInstructorEnabled(isOn)
    if (!isOn) {
      baseline = null
      clearDecorations()
    }
    deps.onStateChange(isOn)
  }

  function recordBaseline(): void {
    if (!isOn) return
    baseline = { path: deps.getEditorPath(), text: deps.editor.getModel()?.getValue() ?? '' }
    recomputeDecorations()
  }

  function discardBaseline(): void {
    baseline = null
    clearDecorations()
  }

  function onContentChanged(): void {
    if (!isOn || !baseline) return
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(recomputeDecorations, RECOMPUTE_DEBOUNCE_MS)
  }

  function onActiveFileChanged(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    recomputeDecorations()
  }

  return {
    isOn: () => isOn,
    toggle,
    recordBaseline,
    discardBaseline,
    onContentChanged,
    onActiveFileChanged,
    fontProfile: () => (isOn ? instructorFontProfile : normalFontProfile),
  }
}
