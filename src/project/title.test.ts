import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_TITLE, normalizeTitle, titleFromFileName, toSafeFileName } from './title'

describe('normalizeTitle', () => {
  it('前後の空白を除く', () => {
    expect(normalizeTitle('  課題1  ')).toBe('課題1')
  })
  it('空・空白のみは既定名になる', () => {
    expect(normalizeTitle('')).toBe(DEFAULT_PROJECT_TITLE)
    expect(normalizeTitle('   ')).toBe(DEFAULT_PROJECT_TITLE)
  })
  it('50文字を超える分は切り詰める', () => {
    expect(Array.from(normalizeTitle('あ'.repeat(80)))).toHaveLength(50)
  })
})

describe('toSafeFileName', () => {
  it('ファイル名に使えない文字を置き換える', () => {
    expect(toSafeFileName('a/b:c*d')).toBe('a_b_c_d')
  })
  it('空になる場合は既定名', () => {
    expect(toSafeFileName('   ')).toBe(DEFAULT_PROJECT_TITLE)
  })
})

describe('titleFromFileName', () => {
  it('拡張子を除く', () => {
    expect(titleFromFileName('foo.narapy')).toBe('foo')
    expect(titleFromFileName('my.project.exercise')).toBe('my.project')
  })
  it('拡張子が無ければそのまま', () => {
    expect(titleFromFileName('foo')).toBe('foo')
  })
})
