// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initAbout } from './index'
import { LICENSES } from './licenses'

function openModal(): HTMLElement {
  document.getElementById('aboutBtn')?.click()
  const modal = document.body.querySelector<HTMLElement>('[role="dialog"]')?.parentElement ?? null
  if (!modal) throw new Error('モーダルが開いていません')
  return modal
}

describe('initAbout', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="aboutBtn"></button>'
    initAbout()
  })

  afterEach(() => {
    // 開いたままのモーダルの keydown リスナーを次のテストへ持ち越さない
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.innerHTML = ''
  })

  it('ボタンでモーダルが開き、ライセンスの件数ぶん行が並ぶ', () => {
    const modal = openModal()
    expect(modal.querySelectorAll('[data-license]')).toHaveLength(LICENSES.length)
  })

  it('外部リンクはすべて別タブで noopener noreferrer 付き', () => {
    const links = openModal().querySelectorAll<HTMLAnchorElement>('a')
    expect(links.length).toBeGreaterThan(0)
    for (const a of links) {
      expect(a.target).toBe('_blank')
      expect(a.rel).toBe('noopener noreferrer')
      expect(a.href.startsWith('https://')).toBe(true)
    }
  })

  it('ダイアログとして読み上げられ、見出しに関連付けられている', () => {
    const dialog = openModal().querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    const labelId = dialog?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(labelId)?.textContent).toBe('オープンソースライセンス')
  })

  it('Escape キーで閉じる', () => {
    openModal()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('背景クリックで閉じる', () => {
    const modal = openModal()
    modal.click()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})
