import type { EditorInstance } from '../editor/index'
import { parseTraceResult } from '../trace/parse'
import {
  createSession, currentStep, canGoNext, canGoPrev,
  next, prev, first, last, seekTo, play, pause, setSpeed, speedDelayMs, tick,
  type SessionState,
} from '../trace/session'
import { diffVars, type VarWithChange } from '../trace/varDiff'
import type { TraceStep } from '../trace/types'
import { createStepDecorations } from './decorations'
import { createStepperUI, type StepperAction } from './ui'

export interface StepperController {
  // Worker から届いた trace メッセージの payload(JSON文字列)を受け取る。
  // パースに失敗、またはステップが1件も無い場合は無効化する。
  onTraceResult: (json: string) => void
  invalidate: () => void
}

// 直前のステップの locals と比較して変数の増減・変更をハイライトする。
// スコープ（funcName + depth）が変わった場合は「新しいスコープに入った」とみなし、
// 全変数を added として表示する（別関数のローカル変数を誤って差分表示しないため）。
function previousLocalsFor(steps: TraceStep[], index: number, step: TraceStep): TraceStep['locals'] | null {
  const previous = steps[index - 1]
  if (!previous) return null
  if (previous.funcName !== step.funcName || previous.depth !== step.depth) return null
  return previous.locals
}

export function createStepperController(editor: EditorInstance): StepperController {
  const decorations = createStepDecorations(editor)
  const ui = createStepperUI()

  let session: SessionState | null = null
  let truncated = false
  let hasError = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function scheduleTick(): void {
    stopTimer()
    if (!session?.playing) return
    const delay = speedDelayMs(session)
    timer = setTimeout(() => {
      if (!session) return
      session = tick(session)
      render()
    }, delay)
  }

  function buildVars(step: TraceStep): { vars: VarWithChange[]; globalsVars: VarWithChange[] | null } {
    if (!session) return { vars: [], globalsVars: null }
    const previousLocals = previousLocalsFor(session.steps, session.index, step)
    return {
      vars: diffVars(previousLocals, step.locals),
      globalsVars: step.globals ? diffVars(null, step.globals) : null,
    }
  }

  function render(): void {
    if (!session) return
    const step = currentStep(session)
    if (!step) return

    const { vars, globalsVars } = buildVars(step)

    ui.render({
      index: session.index,
      total: session.steps.length,
      playing: session.playing,
      speed: session.speed,
      funcName: step.funcName,
      line: step.line,
      vars,
      globalsVars,
      truncated,
      hasError,
      canPrev: canGoPrev(session),
      canNext: canGoNext(session),
    })
    decorations.set(step.line)
    scheduleTick()
  }

  ui.onAction((action: StepperAction) => {
    if (!session) return
    if (action.type === 'close') {
      invalidate()
      return
    }
    switch (action.type) {
      case 'first': session = first(session); break
      case 'prev': session = prev(session); break
      case 'next': session = next(session); break
      case 'last': session = last(session); break
      case 'togglePlay': session = session.playing ? pause(session) : play(session); break
      case 'seek': session = seekTo(session, action.index); break
      case 'speed': session = setSpeed(session, action.speed); break
    }
    render()
  })

  function onTraceResult(json: string): void {
    const parsed = parseTraceResult(json)
    if (!parsed.ok || parsed.result.steps.length === 0) {
      invalidate()
      return
    }
    stopTimer()
    session = createSession(parsed.result.steps)
    truncated = parsed.result.truncated
    hasError = parsed.result.error !== null
    ui.show()
    render()
  }

  function invalidate(): void {
    stopTimer()
    session = null
    truncated = false
    hasError = false
    ui.hide()
    decorations.clear()
  }

  return { onTraceResult, invalidate }
}
