import type { EditorInstance } from '../editor/index'
import { parseTraceResult } from '../trace/parse'
import {
  createSession, currentStep, canGoNext, canGoPrev,
  next, prev, first, last, seekTo, play, pause, setSpeed, speedDelayMs, tick, cumulativeStdout,
  type SessionState,
} from '../trace/session'
import { diffVars, type VarWithChange } from '../trace/varDiff'
import { findPreviousStepInScope, findPreviousGlobalsSnapshot } from '../trace/scopeDiff'
import type { TraceStep } from '../trace/types'
import { createStepDecorations } from './decorations'
import { createStepperUI, type StepperAction } from './ui'

export interface StepperController {
  // Worker から届いた trace メッセージの payload(JSON文字列)を受け取る。
  // パースに失敗、またはステップが1件も無い場合は無効化する。
  onTraceResult: (json: string) => void
  invalidate: () => void
}

export function createStepperController(editor: EditorInstance): StepperController {
  const decorations = createStepDecorations(editor)
  const ui = createStepperUI()

  let session: SessionState | null = null
  let truncated = false
  let hasError = false
  // ステップ上限による打ち切り後、全速実行中に書き込まれた標準出力（どのステップにも
  // 紐付かない）。最終ステップに到達したときだけ「ここまでの出力」の末尾へ付け足す。
  let trailingStdout = ''
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
    const previousStep = findPreviousStepInScope(session.steps, session.index, step)
    const previousGlobals = findPreviousGlobalsSnapshot(session.steps, session.index)
    return {
      vars: diffVars(previousStep?.locals ?? null, step.locals),
      globalsVars: step.globals ? diffVars(previousGlobals, step.globals) : null,
    }
  }

  function render(): void {
    if (!session) return
    const step = currentStep(session)
    if (!step) return

    const { vars, globalsVars } = buildVars(step)
    const isLastStep = !canGoNext(session)
    const stdout = cumulativeStdout(session) + (isLastStep ? trailingStdout : '')

    ui.render({
      index: session.index,
      total: session.steps.length,
      playing: session.playing,
      speed: session.speed,
      funcName: step.funcName,
      line: step.line,
      vars,
      globalsVars,
      stdout,
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
    trailingStdout = parsed.result.trailingStdout
    ui.show()
    render()
  }

  function invalidate(): void {
    stopTimer()
    session = null
    truncated = false
    hasError = false
    trailingStdout = ''
    ui.hide()
    decorations.clear()
  }

  return { onTraceResult, invalidate }
}
