// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openShareModal } from './shareModal'
import type { ShareState } from './shareLinks'

// 圧縮が効かない疑似乱数列(LCG)
function noisyBytes(n: number): Uint8Array {
  let x = 12345
  return Uint8Array.from({ length: n }, () => { x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff; return (x >> 16) & 0xff })
}

const state: ShareState = {
  files: [{ path: 'main.py', content: { kind: 'text', data: 'print(1)' } }],
  directories: [],
  activeFile: 'main.py',
}
const dialog = () => document.querySelector('[role="dialog"]')
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
const find = (label: string) => buttons().find(b => b.textContent?.includes(label))!

describe('openShareModal', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('2種類のコピーボタンを出し、クリックでリンクをコピーして「コピーしました」を出す', async () => {
    const copyText = vi.fn().mockResolvedValue(undefined)
    await openShareModal({ getState: () => state, isExercise: () => false, copyText })
    find('main.py を共有').click()
    await Promise.resolve()
    expect(copyText.mock.calls[0][0]).toContain('#code=')
    expect(find('コピーしました')).toBeTruthy()
    find('現在のプロジェクト全体を共有').click()
    await Promise.resolve()
    expect(copyText.mock.calls[1][0]).toContain('#project=')
  })

  it('コピーに失敗したら案内を出す', async () => {
    const copyText = vi.fn().mockRejectedValue(new Error('denied'))
    await openShareModal({ getState: () => state, isExercise: () => false, copyText })
    find('main.py を共有').click()
    await new Promise(r => setTimeout(r))
    expect(dialog()?.textContent).toContain('コピーできませんでした')
  })

  it('上限超過のリンクはボタンを無効化して案内する', async () => {
    const big = noisyBytes(100_000)
    const s: ShareState = { ...state, files: [...state.files, { path: 'a.png', content: { kind: 'binary', data: big, mime: 'image/png' } }] }
    const copyText = vi.fn()
    await openShareModal({ getState: () => s, isExercise: () => false, copyText })
    const projectBtn = find('現在のプロジェクト全体を共有')
    expect(projectBtn.disabled).toBe(true)
    expect(dialog()?.textContent).toContain('長すぎます')
    expect(find('main.py を共有').disabled).toBe(false)
  })

  it('演習プロジェクトでは注意書きを出す', async () => {
    await openShareModal({ getState: () => state, isExercise: () => true, copyText: vi.fn() })
    expect(dialog()?.textContent).toContain('/make-exercise')
  })

  it('Escape で閉じ、フォーカスを戻す。二重には開かない', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    await openShareModal({ getState: () => state, isExercise: () => false, copyText: vi.fn() })
    await openShareModal({ getState: () => state, isExercise: () => false, copyText: vi.fn() })
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
