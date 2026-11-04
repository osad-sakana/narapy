import { describe, expect, it } from 'vitest'
import { LICENSES } from './licenses'

describe('LICENSES', () => {
  it('名前が重複しない', () => {
    const names = LICENSES.map(e => e.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('すべてのエントリが https のリポジトリURL・著作権表示・ライセンスリンクを持つ', () => {
    for (const entry of LICENSES) {
      expect(entry.url.startsWith('https://'), entry.name).toBe(true)
      expect(entry.copyright.length, entry.name).toBeGreaterThan(0)
      expect(entry.licenses.length, entry.name).toBeGreaterThan(0)
      for (const license of entry.licenses) {
        expect(license.url.startsWith('https://'), `${entry.name}/${license.label}`).toBe(true)
      }
    }
  })

  it('帰属表示が必須の Font Awesome Free と Codicon は CC BY 4.0 のリンクを持つ', () => {
    for (const name of ['Font Awesome Free', 'Codicon']) {
      const entry = LICENSES.find(e => e.name === name)
      expect(entry, name).toBeDefined()
      expect(entry?.licenses.some(l => l.label === 'CC BY 4.0' && l.url.includes('creativecommons.org')), name).toBe(true)
    }
  })

  it('同梱している主な依存が載っている', () => {
    const names = LICENSES.map(e => e.name)
    for (const required of ['Monaco Editor', 'fflate', 'marked', 'DOMPurify', 'coi-serviceworker', 'pygame-ce', 'autopep8', 'pycodestyle', 'micropip']) {
      expect(names, required).toContain(required)
    }
  })
})
