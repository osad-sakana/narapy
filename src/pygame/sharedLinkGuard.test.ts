// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  setCurrentProjectIdProvider,
  clearSharedLinkMark,
  confirmPygameRun,
  isFromSharedLink,
  markLoadedFromSharedLink,
  markProjectFromSharedLink,
} from './sharedLinkGuard'

const dialog = () => document.querySelector('[role="dialog"]')
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
const findBtn = (label: string) => buttons().find(b => b.textContent?.includes(label))

describe('sharedLinkGuard', () => {
  beforeEach(() => {
    setCurrentProjectIdProvider(() => undefined)
    clearSharedLinkMark()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('共有リンクから読み込んでいなければ確認なしで true', async () => {
    expect(isFromSharedLink()).toBe(false)
    expect(await confirmPygameRun()).toBe(true)
    expect(dialog()).toBeNull()
  })

  it('共有リンク由来なら確認ダイアログを出し、実行するで true', async () => {
    markLoadedFromSharedLink('code')
    const p = confirmPygameRun()
    expect(dialog()).not.toBeNull()
    expect(dialog()?.textContent).toContain('共有リンク')
    findBtn('実行する')!.click()
    expect(await p).toBe(true)
    expect(dialog()).toBeNull()
  })

  it('キャンセルで false、次回も再度確認する', async () => {
    markLoadedFromSharedLink('project')
    const p = confirmPygameRun()
    findBtn('キャンセル')!.click()
    expect(await p).toBe(false)
    expect(dialog()).toBeNull()

    const p2 = confirmPygameRun()
    expect(dialog()).not.toBeNull()
    findBtn('キャンセル')!.click()
    expect(await p2).toBe(false)
  })

  it('一度許可したら以降は確認しない', async () => {
    markLoadedFromSharedLink('projectUrl')
    const p = confirmPygameRun()
    findBtn('実行する')!.click()
    await p
    expect(await confirmPygameRun()).toBe(true)
    expect(dialog()).toBeNull()
  })

  it('Escape キーでキャンセル扱い', async () => {
    markLoadedFromSharedLink('code')
    const p = confirmPygameRun()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(await p).toBe(false)
  })

  it('別プロジェクトを読み込んだ(印を消した)後は確認しない', async () => {
    markLoadedFromSharedLink('code')
    clearSharedLinkMark()
    expect(await confirmPygameRun()).toBe(true)
  })

  it('再度共有リンクを読み込むと許可がリセットされる', async () => {
    markLoadedFromSharedLink('code')
    const p = confirmPygameRun()
    findBtn('実行する')!.click()
    await p
    markLoadedFromSharedLink('project')
    const p2 = confirmPygameRun()
    expect(dialog()).not.toBeNull()
    findBtn('キャンセル')!.click()
    expect(await p2).toBe(false)
  })

  it('別プロジェクトへ切り替えると確認不要になり、戻ると再び確認が必要', async () => {
    let id = 'shared'
    setCurrentProjectIdProvider(() => id)
    markLoadedFromSharedLink('code')

    id = 'other'
    expect(isFromSharedLink()).toBe(false)
    expect(await confirmPygameRun()).toBe(true)

    id = 'shared'
    expect(isFromSharedLink()).toBe(true)
    const p = confirmPygameRun()
    expect(dialog()).not.toBeNull()
    findBtn('キャンセル')?.click()
    expect(await p).toBe(false)
  })

  it('許可済みでも別プロジェクトの印には影響しない', async () => {
    let id = 'a'
    setCurrentProjectIdProvider(() => id)
    markLoadedFromSharedLink('code')
    id = 'b'
    markLoadedFromSharedLink('code')
    const p = confirmPygameRun()
    findBtn('実行する')?.click()
    expect(await p).toBe(true)

    id = 'a'
    const q = confirmPygameRun()
    expect(dialog()).not.toBeNull()
    findBtn('キャンセル')?.click()
    expect(await q).toBe(false)
  })

  it('保存済みの共有リンク由来プロジェクトを id 指定で印付けできる', async () => {
    let id = 'saved'
    setCurrentProjectIdProvider(() => id)
    markProjectFromSharedLink('saved', 'projectUrl')
    expect(isFromSharedLink()).toBe(true)
    id = 'other'
    expect(isFromSharedLink()).toBe(false)
  })
})
