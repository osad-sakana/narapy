import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AUTOPEP8_REQUIREMENTS } from '../format/formatModule'
import { LICENSES } from './licenses'

function find(name: string) {
  const entry = LICENSES.find(e => e.name === name)
  if (!entry) throw new Error(`${name} が LICENSES にありません`)
  return entry
}

// 'x.y' のような省略表記でも 'x.y.z' に一致し、'0.8' が '0.80.0' に誤一致しないよう区切りまで見る
function matchesVersion(installed: string, shown: string): boolean {
  return shown !== '' && (installed === shown || installed.startsWith(`${shown}.`))
}

function readBundled(relative: string): string {
  try {
    return readFileSync(new URL(`../../node_modules/monaco-editor/esm/vs/base/${relative}`, import.meta.url), 'utf-8')
  } catch {
    throw new Error(`Monaco 内蔵の ${relative} が見つかりません。Monaco の構成が変わった可能性があるので、licenses.ts の版数と同梱元を確認すること`)
  }
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
      expect(matchesVersion(installedVersion(pkg), find(name).version), name).toBe(true)
    })
  }

  it('marked と DOMPurify は Monaco が内部に持つコピーの版と一致する', () => {
    expect(readBundled('browser/dompurify/dompurify.js')).toContain(`DOMPurify ${find('DOMPurify').version} `)
    expect(readBundled('common/marked/marked.js')).toMatch(new RegExp(`marked v${find('marked').version.replace(/\./g, '\\.')}(\\.|\\b)`))
  })

  it('autopep8 と pycodestyle は整形で固定している版と一致する', () => {
    for (const name of ['autopep8', 'pycodestyle']) {
      expect(AUTOPEP8_REQUIREMENTS, name).toContain(`${name}==${find(name).version}`)
    }
  })
})
