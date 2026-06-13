import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebounced } from './debounce'

describe('createDebounced', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('遅延後に一度だけ実行される', () => {
    const fn = vi.fn()
    const debounced = createDebounced(fn, 100)

    debounced.call('a')
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('連続呼び出しは最後の引数でまとめて実行される', () => {
    const fn = vi.fn()
    const debounced = createDebounced(fn, 100)

    debounced.call('a')
    vi.advanceTimersByTime(50)
    debounced.call('b')
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('cancel すると実行されない', () => {
    const fn = vi.fn()
    const debounced = createDebounced(fn, 100)

    debounced.call('a')
    debounced.cancel()
    vi.advanceTimersByTime(200)

    expect(fn).not.toHaveBeenCalled()
  })
})
