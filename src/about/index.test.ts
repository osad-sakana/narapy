// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initAbout } from './index'
import { LICENSES } from './licenses'

function openModal(): HTMLElement {
  document.getElementById('aboutBtn')?.click()
  const modal = document.body.querySelector<HTMLElement>('.fixed')
  if (!modal) throw new Error('モーダルが開いていません')
  return modal
}

describe('initAbout', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="aboutBtn"></button>'
    initAbout()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('ボタンでモーダルが開き、ライセンスの件数ぶん行が並ぶ', () => {
    const modal = openModal()
    expect(modal.querySelectorAll('.border-line.rounded-lg')).toHaveLength(LICENSES.length)
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

  it('Escape キーで閉じる', () => {
    openModal()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.body.querySelector('.fixed')).toBeNull()
  })

  it('背景クリックで閉じる', () => {
    const modal = openModal()
    modal.click()
    expect(document.body.querySelector('.fixed')).toBeNull()
  })
})
