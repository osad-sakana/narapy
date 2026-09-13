import { describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '../explorer/types'
import { createExerciseController } from './controller'

const exerciseFiles: FileEntry[] = [
  { path: 'main.py', content: { kind: 'text', data: 'def add(a, b):\n    return a + b\n' } },
  { path: 'problem.md', content: { kind: 'text', data: '# 足し算' } },
  { path: 'test.py', content: { kind: 'text', data: 'def test_add():\n    assert add(1, 2) == 3\n' } },
]

const plainFiles: FileEntry[] = [
  { path: 'main.py', content: { kind: 'text', data: 'print(1)' } },
]

describe('createExerciseController', () => {
  it('演習を読み込むと採点UIを表示し、問題文を表示する', () => {
    const setGradeControlsVisible = vi.fn()
    const showProblem = vi.fn()
    const controller = createExerciseController({ setGradeControlsVisible, showProblem, renderResult: vi.fn() })

    controller.onProjectLoaded({ problem: 'problem.md', test: 'test.py' }, exerciseFiles, 'main.py')

    expect(setGradeControlsVisible).toHaveBeenCalledWith(true)
    expect(showProblem).toHaveBeenCalledWith('# 足し算')
    expect(controller.getTestCode()).toBe('def test_add():\n    assert add(1, 2) == 3\n')
    expect(controller.getEntryPath()).toBe('main.py')
  })

  it('通常のプロジェクトでは採点UIを隠し、getTestCode/getEntryPathはnullを返す', () => {
    const setGradeControlsVisible = vi.fn()
    const showProblem = vi.fn()
    const controller = createExerciseController({ setGradeControlsVisible, showProblem, renderResult: vi.fn() })

    controller.onProjectLoaded(undefined, plainFiles, 'main.py')

    expect(setGradeControlsVisible).toHaveBeenCalledWith(false)
    expect(showProblem).not.toHaveBeenCalled()
    expect(controller.getTestCode()).toBeNull()
    expect(controller.getEntryPath()).toBeNull()
  })

  it('壊れた.exercise（problem.mdが無い等）では通常プロジェクト同様に扱い、onBrokenExerciseを呼ぶ', () => {
    const setGradeControlsVisible = vi.fn()
    const onBrokenExercise = vi.fn()
    const controller = createExerciseController({
      setGradeControlsVisible,
      showProblem: vi.fn(),
      renderResult: vi.fn(),
      onBrokenExercise,
    })

    controller.onProjectLoaded({ problem: 'missing.md', test: 'test.py' }, exerciseFiles, 'main.py')

    expect(setGradeControlsVisible).toHaveBeenCalledWith(false)
    expect(controller.getTestCode()).toBeNull()
    expect(onBrokenExercise).toHaveBeenCalledTimes(1)
  })

  it('通常のプロジェクト（exerciseメタデータ自体が無い）ではonBrokenExerciseを呼ばない', () => {
    const onBrokenExercise = vi.fn()
    const controller = createExerciseController({
      setGradeControlsVisible: vi.fn(),
      showProblem: vi.fn(),
      renderResult: vi.fn(),
      onBrokenExercise,
    })

    controller.onProjectLoaded(undefined, plainFiles, 'main.py')

    expect(onBrokenExercise).not.toHaveBeenCalled()
  })

  it('演習から通常プロジェクトへ切り替わると、古い演習の状態を保持しない(state漏れ防止)', () => {
    const setGradeControlsVisible = vi.fn()
    const controller = createExerciseController({ setGradeControlsVisible, showProblem: vi.fn(), renderResult: vi.fn() })

    controller.onProjectLoaded({ problem: 'problem.md', test: 'test.py' }, exerciseFiles, 'main.py')
    expect(controller.getTestCode()).not.toBeNull()

    controller.onProjectLoaded(undefined, plainFiles, 'main.py')

    expect(controller.getTestCode()).toBeNull()
    expect(controller.getEntryPath()).toBeNull()
    expect(setGradeControlsVisible).toHaveBeenLastCalledWith(false)
  })

  it('onGradeResultはrenderResultへそのまま委譲する', () => {
    const renderResult = vi.fn()
    const controller = createExerciseController({ setGradeControlsVisible: vi.fn(), showProblem: vi.fn(), renderResult })

    controller.onGradeResult('{"cases":[],"error":null}')

    expect(renderResult).toHaveBeenCalledWith('{"cases":[],"error":null}')
  })
})
