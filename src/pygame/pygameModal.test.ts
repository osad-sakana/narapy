// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PygameIO, PygameSession } from './pygameRunner'

const startPygame = vi.fn()
vi.mock('./pygameRunner', () => ({
  startPygame: (...args: unknown[]) => startPygame(...args),
  PygameStalledError: class PygameStalledError extends Error {
    constructor() {
      super('応答がなかったため実行を停止しました')
    }
  },
}))

const appendLog = vi.fn()
const appendErrorBlock = vi.fn()
vi.mock('../runner/log', () => ({
  appendLog: (...args: unknown[]) => appendLog(...args),
  appendErrorBlock: (...args: unknown[]) => appendErrorBlock(...args),
}))

const translatePythonError = vi.fn()
vi.mock('../runner/errorTranslator', () => ({
  translatePythonError: (...args: unknown[]) => translatePythonError(...args),
}))

import { PygameStalledError } from './pygameRunner'
import { showPygameModal } from './pygameModal'

function createSession(done: Promise<void> = new Promise(() => {}), syncLoop = true): PygameSession {
  return { done, cancel: vi.fn(), syncLoop }
}

const project = { files: [], directories: [] }

function hooks() {
  return { onOpen: vi.fn(), onClose: vi.fn() }
}

const modal = () => document.querySelector('[role="dialog"]')
const closeButton = () => modal()!.querySelector('button') as HTMLButtonElement
const canvas = () => modal()!.querySelector('canvas') as HTMLCanvasElement
const status = () => modal()!.querySelector('span.text-xs')!.textContent
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('showPygameModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'Narapy'
    translatePythonError.mockReturnValue(null)
  })

  afterEach(() => {
    // 開いたままのモーダルの title 監視が次のテストへ残らないよう、実際の閉じる操作で片付ける
    modal()?.querySelector('button')?.click()
    document.body.innerHTML = ''
  })

  it('開いた直後に onOpen を呼び、全画面の dialog を表示する', () => {
    startPygame.mockReturnValue(new Promise(() => {}))
    const h = hooks()
    showPygameModal('import pygame', project, h)

    expect(h.onOpen).toHaveBeenCalledTimes(1)
    expect(modal()?.getAttribute('aria-modal')).toBe('true')
    expect(modal()?.className).toContain('fixed inset-0')
    expect(status()).toBe('読み込み中...')
    expect(startPygame).toHaveBeenCalledWith('import pygame', canvas(), expect.any(Object), project, expect.any(Function))
  })

  it('読み込み完了で「実行中」になり、canvas にフォーカスする', async () => {
    startPygame.mockResolvedValue(createSession())
    showPygameModal('x', project, hooks())
    await flush()

    expect(status()).toBe('実行中')
    expect(document.activeElement).toBe(canvas())
  })

  it('スクリプトが終了するとモーダルは開いたまま「終了しました」を表示する', async () => {
    startPygame.mockResolvedValue(createSession(Promise.resolve()))
    const h = hooks()
    showPygameModal('x', project, h)
    await flush()

    expect(status()).toBe('終了しました')
    expect(modal()).not.toBeNull()
    expect(h.onClose).not.toHaveBeenCalled()
  })

  it('開始前に閉じられたかを startPygame が確認できるよう、閉じた状態を渡す', async () => {
    startPygame.mockReturnValue(new Promise(() => {}))
    showPygameModal('x', project, hooks())
    const isClosed = startPygame.mock.calls[0][4] as () => boolean

    expect(isClosed()).toBe(false)
    closeButton().click()
    expect(isClosed()).toBe(true)
  })

  it('停止して閉じるで実行を cancel し、モーダルを消して onClose を 1 回だけ呼ぶ', async () => {
    const session = createSession()
    startPygame.mockResolvedValue(session)
    const h = hooks()
    showPygameModal('x', project, h)
    await flush()

    const btn = closeButton()
    btn.click()
    btn.click()

    expect(session.cancel).toHaveBeenCalledTimes(1)
    expect(modal()).toBeNull()
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape ではゲーム入力用に閉じない', async () => {
    startPygame.mockResolvedValue(createSession())
    const h = hooks()
    showPygameModal('x', project, h)
    await flush()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(modal()).not.toBeNull()
    expect(h.onClose).not.toHaveBeenCalled()
  })

  it('読み込み中に閉じた場合、セッション確立後すぐ cancel する', async () => {
    let resolveStart!: (s: PygameSession) => void
    startPygame.mockReturnValue(new Promise<PygameSession>((r) => { resolveStart = r }))
    const h = hooks()
    showPygameModal('x', project, h)

    closeButton().click()
    expect(h.onClose).toHaveBeenCalledTimes(1)

    const session = createSession()
    resolveStart(session)
    await flush()
    expect(session.cancel).toHaveBeenCalledTimes(1)
  })

  it('開始に失敗したらエラーをログへ出してモーダルを閉じる', async () => {
    startPygame.mockRejectedValue(new Error('network down'))
    const h = hooks()
    showPygameModal('x', project, h)
    await flush()

    expect(appendLog).toHaveBeenCalledWith('[エラー] network down', 'error')
    expect(modal()).toBeNull()
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('翻訳できる Python エラーはエラーブロックで表示する', async () => {
    const translated = { title: 'NameError', message: 'm' }
    translatePythonError.mockReturnValue(translated)
    const session = createSession(Promise.reject(new Error('NameError: x')))
    startPygame.mockResolvedValue(session)
    const h = hooks()
    showPygameModal('x', project, h)
    await flush()

    expect(appendErrorBlock).toHaveBeenCalledWith({ ...translated, raw: 'NameError: x' })
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('set_mode / set_caption の通知で canvas サイズとタイトルを更新する', async () => {
    startPygame.mockResolvedValue(createSession())
    showPygameModal('x', project, hooks())
    await flush()

    const io = startPygame.mock.calls[0][2] as PygameIO
    io.onResize(480, 320)
    io.onCaption('My Game')

    expect(canvas().width).toBe(480)
    expect(canvas().height).toBe(320)
    expect(modal()!.textContent).toContain('🎮 My Game')
  })

  it('SDL が document.title を書き換えても元のタイトルへ戻す', async () => {
    startPygame.mockResolvedValue(createSession())
    showPygameModal('x', project, hooks())
    await flush()

    document.title = 'pygame window'
    await flush()
    expect(document.title).toBe('Narapy')
  })

  it('閉じた後は document.title の監視を止める', async () => {
    startPygame.mockResolvedValue(createSession())
    showPygameModal('x', project, hooks())
    await flush()
    closeButton().click()

    document.title = 'other'
    await flush()
    expect(document.title).toBe('other')
  })

  it('同期ループ対応のブラウザで固まった場合は、ループ内で flip / tick を呼ぶよう案内する', async () => {
    startPygame.mockResolvedValue(createSession(Promise.reject(new PygameStalledError()), true))
    const h = hooks()
    showPygameModal('x', project, h)
    await flush()

    expect(appendLog).toHaveBeenCalledWith('--- 応答がなかったため実行を停止しました ---', 'warn')
    expect(appendLog).toHaveBeenCalledWith(expect.stringContaining('pygame.display.flip()'), 'info')
    expect(appendLog).not.toHaveBeenCalledWith(expect.stringContaining('asyncio'), 'info')
    expect(appendErrorBlock).not.toHaveBeenCalled()
    expect(modal()).toBeNull()
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('同期ループ非対応のブラウザで固まった場合は、await asyncio.sleep(0) の書き方を案内する', async () => {
    startPygame.mockResolvedValue(createSession(Promise.reject(new PygameStalledError()), false))
    showPygameModal('x', project, hooks())
    await flush()

    expect(appendLog).toHaveBeenCalledWith(expect.stringContaining('await asyncio.sleep(0)'), 'info')
    expect(modal()).toBeNull()
  })
})
