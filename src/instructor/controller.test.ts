import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorInstance } from '../editor/index'

// environment: 'node' のため localStorage が存在しない。テストに必要な最小限の
// Storage 実装だけを vi.stubGlobal でスタブし、jsdom 化は避ける（他の全テストへの
// 影響を防ぐため）。
function createLocalStorageStub(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size },
  }
}

// decorations.ts は monaco-editor 本体（DOM依存）をimportするためnode環境では読み込めない。
// controller.ts の関心事は「いつ・どのモデルに対して装飾を張り替えるか」という状態遷移であり、
// 実際の装飾の中身（decorations.test.ts で別途検証済み）ではないため、ここではモック化して良い。
const buildDecorationsMock = vi.fn((_baseline: string, current: string) => [{ marker: current }])
vi.mock('./decorations', () => ({
  buildDecorations: (baseline: string, current: string) => buildDecorationsMock(baseline, current),
}))

const { createInstructorController } = await import('./controller')

// 複数モデルを保持できるフェイクエディタ。ファイル切替時に
// IEditorDecorationsCollection.set() が「その時点でアタッチされているモデル」に対して
// しか効かないというMonacoの実際の仕様を再現する（装飾リークの回帰テストのため）。
function createFakeEditor() {
  const models = new Map<string, { getValue: () => string }>()
  let attachedPath = 'main.py'
  const setCallsByPath: Record<string, unknown[][]> = {}

  function ensureModel(path: string, text: string): void {
    if (!models.has(path)) models.set(path, { getValue: () => text })
  }
  ensureModel('main.py', '')

  const collection = {
    set: (decorations: unknown[]) => {
      const calls = setCallsByPath[attachedPath] ?? []
      calls.push(decorations)
      setCallsByPath[attachedPath] = calls
    },
  }

  const editor = {
    createDecorationsCollection: () => collection,
    getModel: () => models.get(attachedPath) ?? null,
  } as unknown as EditorInstance

  return {
    editor,
    setContent: (path: string, text: string) => {
      ensureModel(path, text)
      models.set(path, { getValue: () => text })
    },
    switchAttachedModel: (path: string, text: string) => {
      models.set(path, { getValue: () => text })
      attachedPath = path
    },
    lastSetFor: (path: string): unknown[] | undefined => {
      const calls = setCallsByPath[path]
      return calls?.at(-1)
    },
  }
}

describe('instructor controller', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageStub())
    vi.useFakeTimers()
    buildDecorationsMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('OFF状態で初期化される（localStorage未設定時）', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    expect(controller.isOn()).toBe(false)
  })

  it('recordBaseline はOFF中は何もしない', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    controller.recordBaseline()
    expect(buildDecorationsMock).not.toHaveBeenCalled()
  })

  it('ON→基準記録→編集→デバウンス経過後に装飾が再計算される', () => {
    const fake = createFakeEditor()
    let path = 'main.py'
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => path })

    controller.toggle()
    expect(controller.isOn()).toBe(true)
    controller.recordBaseline()
    expect(buildDecorationsMock).toHaveBeenCalledTimes(1)

    fake.setContent('main.py', 'changed')
    controller.onContentChanged()
    expect(buildDecorationsMock).toHaveBeenCalledTimes(1) // デバウンス中はまだ呼ばれない

    vi.advanceTimersByTime(499)
    expect(buildDecorationsMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(buildDecorationsMock).toHaveBeenCalledTimes(2)
  })

  it('連続した onContentChanged はデバウンスされ、最後の1回だけ再計算する', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    controller.toggle()
    controller.recordBaseline()
    buildDecorationsMock.mockClear()

    controller.onContentChanged()
    vi.advanceTimersByTime(200)
    controller.onContentChanged()
    vi.advanceTimersByTime(200)
    controller.onContentChanged()
    vi.advanceTimersByTime(500)

    expect(buildDecorationsMock).toHaveBeenCalledTimes(1)
  })

  it('toggle でOFFにすると基準が破棄され、保留中のデバウンスもキャンセルされる', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    controller.toggle()
    controller.recordBaseline()
    buildDecorationsMock.mockClear()

    controller.onContentChanged()
    controller.toggle() // OFF
    vi.advanceTimersByTime(1000)

    expect(buildDecorationsMock).not.toHaveBeenCalled()
    expect(controller.isOn()).toBe(false)
  })

  it('discardBaseline 後に onContentChanged を呼んでも何も起きない', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    controller.toggle()
    controller.recordBaseline()
    controller.discardBaseline()
    buildDecorationsMock.mockClear()

    controller.onContentChanged()
    vi.advanceTimersByTime(1000)

    expect(buildDecorationsMock).not.toHaveBeenCalled()
  })

  it('discardBaselineIfPath は該当パスの基準のみを破棄する', () => {
    const fake = createFakeEditor()
    let path = 'main.py'
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => path })
    controller.toggle()
    controller.recordBaseline() // main.py に対して記録
    buildDecorationsMock.mockClear()

    controller.discardBaselineIfPath('util.py') // 無関係なパス
    controller.onContentChanged()
    vi.advanceTimersByTime(1000)
    expect(buildDecorationsMock).toHaveBeenCalledTimes(1) // main.pyの基準はまだ生きている

    controller.discardBaselineIfPath('main.py')
    buildDecorationsMock.mockClear()
    controller.onContentChanged()
    vi.advanceTimersByTime(1000)
    expect(buildDecorationsMock).not.toHaveBeenCalled()
  })

  it('ファイル切替: beforeActiveFileChangeは旧モデルに対してclearし、切替後の再計算は新モデルには影響しない（装飾リークの回帰テスト）', () => {
    const fake = createFakeEditor()
    let path = 'main.py'
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => path })

    controller.toggle()
    controller.recordBaseline() // main.py に基準を記録
    fake.setContent('main.py', 'changed in main')
    controller.onContentChanged()
    vi.advanceTimersByTime(500) // main.py に装飾が張られる
    expect(fake.lastSetFor('main.py')).toEqual([{ marker: 'changed in main' }])

    // util.py へ切替（Monacoの実際のタイミングに合わせ、setModelの前にbeforeActiveFileChangeを呼ぶ）
    controller.beforeActiveFileChange()
    fake.switchAttachedModel('util.py', 'util content')
    path = 'util.py'
    controller.onActiveFileChanged()

    // 旧モデル(main.py)側で最後に呼ばれたのは空配列でのクリアであるべき
    // （モデル差し替え後にクリアすると、新モデル側に空配列がセットされるだけで
    //   旧モデルの装飾は残り続けてしまう＝今回のバグの再現条件）
    expect(fake.lastSetFor('main.py')).toEqual([])
    // 新モデル(util.py)には基準が無いため装飾はセットされない
    expect(fake.lastSetFor('util.py')).toEqual([])
  })

  it('同じファイルに戻ると基準との差分が再表示される', () => {
    const fake = createFakeEditor()
    let path = 'main.py'
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => path })
    controller.toggle()
    controller.recordBaseline()

    controller.beforeActiveFileChange()
    fake.switchAttachedModel('util.py', 'util content')
    path = 'util.py'
    controller.onActiveFileChanged()

    controller.beforeActiveFileChange()
    path = 'main.py'
    // main.py は 'reuse' で既存モデルを保持し続けるため attachedPath を戻すだけでよい
    fake.switchAttachedModel('main.py', 'main content')
    controller.onActiveFileChanged()

    expect(fake.lastSetFor('main.py')).toEqual([{ marker: 'main content' }])
  })

  it('fontProfile はON/OFFに応じて講師用/通常のプロファイルを切り替える', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    const offProfile = controller.fontProfile()
    controller.toggle()
    const onProfile = controller.fontProfile()
    expect(onProfile).not.toBe(offProfile)
  })

  it('onStateChange で登録したリスナーが toggle のたびに呼ばれる', () => {
    const fake = createFakeEditor()
    const controller = createInstructorController({ editor: fake.editor, getEditorPath: () => 'main.py' })
    const listener = vi.fn()
    controller.onStateChange(listener)

    controller.toggle()
    expect(listener).toHaveBeenCalledWith(true)
    controller.toggle()
    expect(listener).toHaveBeenCalledWith(false)
  })
})
