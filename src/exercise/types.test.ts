import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../explorer/types'
import { resolveExercise } from './types'

const files: FileEntry[] = [
  { path: 'main.py', content: { kind: 'text', data: 'def add(a, b):\n    return a + b\n' } },
  { path: 'problem.md', content: { kind: 'text', data: '# 足し算\n2つの数を足す関数を書いてください。' } },
  { path: 'test.py', content: { kind: 'text', data: 'def test_add():\n    assert add(1, 2) == 3\n' } },
]

describe('resolveExercise', () => {
  it('exerciseが無ければnullを返す', () => {
    expect(resolveExercise(undefined, files, 'main.py')).toBeNull()
  })

  it('problem/testファイルの中身とentryPathを取り出す', () => {
    const result = resolveExercise({ problem: 'problem.md', test: 'test.py' }, files, 'main.py')
    expect(result).toEqual({
      meta: { problem: 'problem.md', test: 'test.py' },
      problemText: '# 足し算\n2つの数を足す関数を書いてください。',
      testCode: 'def test_add():\n    assert add(1, 2) == 3\n',
      entryPath: 'main.py',
    })
  })

  it('problemファイルが存在しなければnullを返す(壊れた.exerciseへのフェイルセーフ)', () => {
    const result = resolveExercise({ problem: 'missing.md', test: 'test.py' }, files, 'main.py')
    expect(result).toBeNull()
  })

  it('testファイルが存在しなければnullを返す', () => {
    const result = resolveExercise({ problem: 'problem.md', test: 'missing.py' }, files, 'main.py')
    expect(result).toBeNull()
  })

  it('activeFile(採点対象)が存在しなければnullを返す', () => {
    const result = resolveExercise({ problem: 'problem.md', test: 'test.py' }, files, 'missing.py')
    expect(result).toBeNull()
  })

  it('problem/testがバイナリファイルの場合はnullを返す', () => {
    const binaryFiles: FileEntry[] = [
      { path: 'problem.md', content: { kind: 'binary', data: new Uint8Array(), mime: 'application/octet-stream' } },
      { path: 'test.py', content: { kind: 'text', data: 'def test_x(): assert True' } },
      { path: 'main.py', content: { kind: 'text', data: 'x = 1' } },
    ]
    const result = resolveExercise({ problem: 'problem.md', test: 'test.py' }, binaryFiles, 'main.py')
    expect(result).toBeNull()
  })

  it('activeFile(採点対象)がバイナリファイルの場合はnullを返す', () => {
    const withBinaryEntry: FileEntry[] = [
      ...files,
      { path: 'image.png', content: { kind: 'binary', data: new Uint8Array(), mime: 'image/png' } },
    ]
    const result = resolveExercise({ problem: 'problem.md', test: 'test.py' }, withBinaryEntry, 'image.png')
    expect(result).toBeNull()
  })
})
