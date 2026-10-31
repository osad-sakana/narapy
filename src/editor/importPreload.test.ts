import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createImportPreloader } from './importPreload'

describe('createImportPreloader', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('入力が止まって待ち時間が過ぎてから、import があれば送る', () => {
    const send = vi.fn()
    const preloader = createImportPreloader({ delayMs: 500, send })
    preloader.schedule('import pygame\n', 2)
    vi.advanceTimersByTime(499)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(send).toHaveBeenCalledWith('import pygame\n', 2)
  })

  it('入力が続く間は送らず、最後の内容だけを送る', () => {
    const send = vi.fn()
    const preloader = createImportPreloader({ delayMs: 500, send })
    preloader.schedule('import p', 1)
    vi.advanceTimersByTime(300)
    preloader.schedule('import pygame\n', 2)
    vi.advanceTimersByTime(300)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('import pygame\n', 2)
  })

  it('import の一覧が前回と同じなら送らない', () => {
    const send = vi.fn()
    const preloader = createImportPreloader({ delayMs: 100, send })
    preloader.schedule('import pygame\nx = 1', 2)
    vi.advanceTimersByTime(100)
    preloader.schedule('import pygame\nx = 12', 2)
    vi.advanceTimersByTime(100)
    expect(send).toHaveBeenCalledTimes(1)
    preloader.schedule('import pygame\nimport matplotlib\n', 3)
    vi.advanceTimersByTime(100)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('import が無いコードは送らない', () => {
    const send = vi.fn()
    const preloader = createImportPreloader({ delayMs: 100, send })
    preloader.schedule('print(1)', 1)
    vi.advanceTimersByTime(100)
    expect(send).not.toHaveBeenCalled()
  })

  it('入力中の行の import は途中の綴りなので対象にしない', () => {
    const send = vi.fn()
    const preloader = createImportPreloader({ delayMs: 100, send })
    preloader.schedule('import pyga', 1)
    vi.advanceTimersByTime(100)
    expect(send).not.toHaveBeenCalled()
  })

  it('dispose すると待機中の送信を取り消す', () => {
    const send = vi.fn()
    const preloader = createImportPreloader({ delayMs: 100, send })
    preloader.schedule('import pygame\n', 2)
    preloader.dispose()
    vi.advanceTimersByTime(1000)
    expect(send).not.toHaveBeenCalled()
  })
})
