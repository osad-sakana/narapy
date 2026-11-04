import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AUTOPEP8_REQUIREMENTS } from '../format/formatModule'
import { LICENSES } from './licenses'

function find(name: string) {
  const entry = LICENSES.find(e => e.name === name)
  if (!entry) throw new Error(`${name} が LICENSES にありません`)
  return entry
}

function installedVersion(pkg: string): string {
  const raw = readFileSync(new URL(`../../node_modules/${pkg}/package.json`, import.meta.url), 'utf-8')
  return (JSON.parse(raw) as { version: string }).version
}

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
      const entry = find(name)
      expect(entry.licenses.some(l => l.label === 'CC BY 4.0' && l.url.includes('creativecommons.org')), name).toBe(true)
    }
  })

  it('同梱している主な依存が載っている', () => {
    const names = LICENSES.map(e => e.name)
    for (const required of ['Monaco Editor', 'fflate', 'marked', 'DOMPurify', 'coi-serviceworker', 'pygame-ce', 'autopep8', 'pycodestyle', 'micropip']) {
      expect(names, required).toContain(required)
    }
  })
})

// 表示している版数が実際に入っているものとずれていないこと（依存を上げたときに表の更新漏れを検出する）
describe('LICENSES の版数', () => {
  const npmPackages: ReadonlyArray<[string, string]> = [
    ['Monaco Editor', 'monaco-editor'],
    ['split.js', 'split.js'],
    ['Tailwind CSS', 'tailwindcss'],
    ['fflate', 'fflate'],
    ['coi-serviceworker', 'coi-serviceworker'],
    ['Font Awesome Free', '@fortawesome/fontawesome-free'],
  ]

  for (const [name, pkg] of npmPackages) {
    it(`${name} は node_modules の版と一致する`, () => {
      expect(installedVersion(pkg).startsWith(find(name).version), name).toBe(true)
    })
  }

  it('marked と DOMPurify は Monaco が内部に持つコピーの版と一致する', () => {
    const base = '../../node_modules/monaco-editor/esm/vs/base/'
    const dompurify = readFileSync(new URL(`${base}browser/dompurify/dompurify.js`, import.meta.url), 'utf-8')
    expect(dompurify).toContain(`DOMPurify ${find('DOMPurify').version} `)
    const marked = readFileSync(new URL(`${base}common/marked/marked.js`, import.meta.url), 'utf-8')
    expect(marked).toContain(`marked v${find('marked').version}`)
  })

  it('autopep8 と pycodestyle は整形で固定している版と一致する', () => {
    for (const name of ['autopep8', 'pycodestyle']) {
      expect(AUTOPEP8_REQUIREMENTS, name).toContain(`${name}==${find(name).version}`)
    }
  })
})
