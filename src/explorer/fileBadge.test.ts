import { describe, it, expect } from 'vitest'
import { fileBadge } from './fileBadge'

describe('fileBadge', () => {
  it('拡張子ごとのラベルを返す', () => {
    expect(fileBadge('main.py')?.label).toBe('PY')
    expect(fileBadge('data/a.csv')?.label).toBe('CSV')
    expect(fileBadge('config.json')?.label).toBe('JSON')
    expect(fileBadge('README.md')?.label).toBe('MD')
    expect(fileBadge('memo.txt')?.label).toBe('TXT')
  })

  it('拡張子は大文字小文字を区別しない', () => {
    expect(fileBadge('MAIN.PY')?.label).toBe('PY')
  })

  it('画像などバッジを持たない種類は null', () => {
    expect(fileBadge('a.png')).toBeNull()
    expect(fileBadge('a.jpg')).toBeNull()
  })

  it('未知の拡張子は拡張子の先頭3文字を大文字で返す', () => {
    expect(fileBadge('a.xlsx')?.label).toBe('XLS')
  })

  it('拡張子なしは null', () => {
    expect(fileBadge('Makefile')).toBeNull()
  })
})
