import { describe, expect, it } from 'vitest'
import { findPreviousStepInScope, findPreviousGlobalsSnapshot } from './scopeDiff'
import type { TraceStep, TraceVar } from './types'

function step(
  depth: number,
  funcName: string,
  locals: TraceVar[] = [],
  globals: TraceVar[] | null = null,
): TraceStep {
  return { line: 1, event: 'line', funcName, depth, locals, globals, stdout: '' }
}

describe('findPreviousStepInScope', () => {
  it('直前が同じスコープならそれを返す', () => {
    const steps = [step(0, '<module>'), step(0, '<module>')]
    expect(findPreviousStepInScope(steps, 1, steps[1])).toBe(steps[0])
  })

  it('関数呼び出しをまたいでも、戻った後は呼び出し前のモジュールスコープと比較できる', () => {
    // module -> call add() -> return to module
    const steps = [
      step(0, '<module>'), // 0: モジュール開始
      step(1, 'add'),      // 1: add() の中
      step(0, '<module>'), // 2: add() から戻った直後
    ]
    // index 2 の直前(index1)は depth1 の add なので、そこから遡って
    // depth0 の <module> ステップ(index0)を見つける必要がある
    expect(findPreviousStepInScope(steps, 2, steps[2])).toBe(steps[0])
  })

  it('より浅いフレームまで遡ったら null を返す（別呼び出しのスコープに入るため）', () => {
    const steps = [
      step(0, '<module>'), // 0
      step(1, 'add'),      // 1: add() 呼び出し開始（直前がdepth0なので探索終了）
    ]
    expect(findPreviousStepInScope(steps, 1, steps[1])).toBeNull()
  })

  it('先頭ステップでは null を返す', () => {
    const steps = [step(0, '<module>')]
    expect(findPreviousStepInScope(steps, 0, steps[0])).toBeNull()
  })
})

describe('findPreviousGlobalsSnapshot', () => {
  it('直近のglobalsスナップショットを返す', () => {
    const g1: TraceVar[] = [{ name: 'x', type: 'int', value: '1' }]
    const steps = [
      step(0, '<module>'),
      step(1, 'add', [], g1),
      step(1, 'add', [], null),
    ]
    expect(findPreviousGlobalsSnapshot(steps, 2)).toBe(g1)
  })

  it('depth0（モジュール直下）のステップまで遡ったら、その locals をグローバルとして返す', () => {
    // 関数に初めて入った瞬間はglobalsを持つステップが1件も無いため、
    // モジュール直下の locals（＝globalsと同一）まで遡って比較する必要がある
    const moduleLocals: TraceVar[] = [{ name: 'x', type: 'int', value: '1' }]
    const steps = [step(0, '<module>', moduleLocals), step(1, 'add')]
    expect(findPreviousGlobalsSnapshot(steps, 1)).toBe(moduleLocals)
  })

  it('depth0のステップも無ければ null を返す', () => {
    const steps = [step(1, 'add')]
    expect(findPreviousGlobalsSnapshot(steps, 1)).toBeNull()
  })
})
