import { describe, expect, it } from 'vitest'
import { buildProjectFromRows } from './buildProject'

describe('buildProjectFromRows', () => {
  it('入力行からNarapyProjectを組み立てる', () => {
    const rows = [
      { path: 'main.py', content: 'print(1)' },
      { path: 'util.py', content: 'def f(): pass' },
    ]
    const project = buildProjectFromRows(rows, 0)
    expect(project).toEqual({
      version: 2,
      files: [
        { path: 'main.py', content: { kind: 'text', data: 'print(1)' } },
        { path: 'util.py', content: { kind: 'text', data: 'def f(): pass' } },
      ],
      directories: [],
      activeFile: 'main.py',
    })
  })

  it('activeIndexで指定した行がactiveFileになる', () => {
    const rows = [{ path: 'main.py', content: '' }, { path: 'util.py', content: '' }]
    expect(buildProjectFromRows(rows, 1).activeFile).toBe('util.py')
  })

  it('パス未入力の行は除外される', () => {
    const rows = [{ path: 'main.py', content: '1' }, { path: '  ', content: '2' }]
    const project = buildProjectFromRows(rows, 0)
    expect(project.files).toHaveLength(1)
  })

  it('前後の空白はパスから取り除かれる', () => {
    const rows = [{ path: '  main.py  ', content: '1' }]
    expect(buildProjectFromRows(rows, 0).files[0].path).toBe('main.py')
  })

  it('有効なファイルが1つもなければエラーになる', () => {
    expect(() => buildProjectFromRows([{ path: '', content: '' }], 0)).toThrow(/ファイル/)
  })

  it('パスが重複している場合はエラーになる', () => {
    const rows = [{ path: 'main.py', content: '1' }, { path: 'main.py', content: '2' }]
    expect(() => buildProjectFromRows(rows, 0)).toThrow(/重複/)
  })

  it('activeIndexの行のパスが空ならactiveFileは先頭の有効な行にフォールバックする', () => {
    const rows = [{ path: 'main.py', content: '1' }, { path: '  ', content: '2' }]
    expect(buildProjectFromRows(rows, 1).activeFile).toBe('main.py')
  })
})
