import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_TITLE, buildDownloadFileName, normalizeTitle, titleFromFileName, toSafeFileName } from './title'

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

describe('buildDownloadFileName', () => {
  it('YYMMDD_タイトル.narapy 形式になる', () => {
    expect(buildDownloadFileName('課題1', new Date(2026, 10, 18))).toBe('261118_課題1.narapy')
  })
  it('月日は2桁にゼロ埋めする', () => {
    expect(buildDownloadFileName('a', new Date(2026, 0, 5))).toBe('260105_a.narapy')
  })
  it('ファイル名に使えない文字は置き換える', () => {
    expect(buildDownloadFileName('a/b', new Date(2026, 10, 18))).toBe('261118_a_b.narapy')
  })
})

describe('ダウンロード名と取り込みの往復', () => {
  it('年の下2桁をゼロ埋めする', () => {
    expect(buildDownloadFileName('a', new Date(2005, 0, 1))).toBe('050101_a.narapy')
  })
  it('保存したファイル名から元のタイトルに戻る', () => {
    const name = buildDownloadFileName('課題1', new Date(2026, 10, 18))
    expect(titleFromFileName(name)).toBe('課題1')
  })
})

describe('titleFromFileName', () => {
  it('6桁以外の数字や接頭辞のみの名前は消さない', () => {
    expect(titleFromFileName('1234567_x.narapy')).toBe('1234567_x')
    expect(titleFromFileName('261118_.narapy')).toBe('261118_')
  })
  it('YYMMDD_ の接頭辞を除く', () => {
    expect(titleFromFileName('261118_課題1.narapy')).toBe('課題1')
  })
  it('拡張子を除く', () => {
    expect(titleFromFileName('foo.narapy')).toBe('foo')
    expect(titleFromFileName('my.project.exercise')).toBe('my.project')
  })
  it('拡張子が無ければそのまま', () => {
    expect(titleFromFileName('foo')).toBe('foo')
  })
})
