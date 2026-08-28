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
}

export interface InstructorController {
  isOn: () => boolean
  toggle: () => void
  recordBaseline: () => void
  discardBaseline: () => void
  discardBaselineIfPath: (path: string) => void
  onContentChanged: () => void
  beforeActiveFileChange: () => void
  onActiveFileChanged: () => void
  fontProfile: () => FontSizeProfile
  // ON/OFF切替を検知するリスナーを登録する。main.ts側でフォント表示やメニュー項目の
  // 更新に使う依存（fontControls等）はcontroller構築より後に生成されるため、
  // deps注入ではなく構築後に登録できるようにしている
  onStateChange: (listener: (isOn: boolean) => void) => void
}

// 講師モードの状態遷移（ON/OFF・基準記録・装飾の張り替え）を管理する。
// 基準スナップショットはメモリのみで保持し、対象ファイルのパスと組にして持つ。
// 現在表示中のファイルが基準記録時と異なる場合は、無意味な全文diffを表示しないよう
// 装飾を消すだけに留める（基準そのものは破棄しない。同じファイルに戻れば再表示される）。
export function createInstructorController(deps: InstructorControllerDeps): InstructorController {
  let isOn = getInstructorEnabled()
  let baseline: { path: string; text: string } | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let stateChangeListener: ((isOn: boolean) => void) | null = null

  const decorationsCollection = deps.editor.createDecorationsCollection([])

  function cancelPendingRecompute(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function clearDecorations(): void {
    cancelPendingRecompute()
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
    stateChangeListener?.(isOn)
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

  // 削除されたファイルが非アクティブ（=切替を経由しない）だった場合に、その基準だけを
  // 対象を絞って破棄する。無関係なファイルの削除で他ファイルの基準まで失わないようにする。
  function discardBaselineIfPath(path: string): void {
    if (baseline?.path === path) discardBaseline()
  }

  function onContentChanged(): void {
    if (!isOn || !baseline) return
    cancelPendingRecompute()
    debounceTimer = setTimeout(recomputeDecorations, RECOMPUTE_DEBOUNCE_MS)
  }

  // IEditorDecorationsCollection.set() は「その時点でエディタにアタッチされているモデル」
  // に対してのみ有効（Monaco内部でモデルごとの装飾IDマップを引くため）。ファイル切替で
  // モデルを差し替えた後にクリアすると、古い装飾IDは新モデルには存在せず黙って無視され、
  // 元のモデル（reuse方式で切替後も保持され続ける）上に装飾が残り続けてしまう。
  // そのためモデル差し替えの直前・直後の両方でフックする。
  function beforeActiveFileChange(): void {
    clearDecorations()
  }

  function onActiveFileChanged(): void {
    cancelPendingRecompute()
    recomputeDecorations()
  }

  return {
    isOn: () => isOn,
    toggle,
    recordBaseline,
    discardBaseline,
    discardBaselineIfPath,
    onContentChanged,
    beforeActiveFileChange,
    onActiveFileChanged,
    fontProfile: () => (isOn ? instructorFontProfile : normalFontProfile),
    onStateChange: (listener) => { stateChangeListener = listener },
  }
}
