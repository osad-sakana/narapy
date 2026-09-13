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
    expect(resolveExercise(undefined, files)).toBeNull()
  })

  it('problem/testファイルの中身を取り出す', () => {
    const result = resolveExercise({ problem: 'problem.md', test: 'test.py' }, files)
    expect(result).toEqual({
      meta: { problem: 'problem.md', test: 'test.py' },
      problemText: '# 足し算\n2つの数を足す関数を書いてください。',
      testCode: 'def test_add():\n    assert add(1, 2) == 3\n',
    })
  })

  it('problemファイルが存在しなければnullを返す(壊れた.exerciseへのフェイルセーフ)', () => {
    const result = resolveExercise({ problem: 'missing.md', test: 'test.py' }, files)
    expect(result).toBeNull()
  })

  it('testファイルが存在しなければnullを返す', () => {
    const result = resolveExercise({ problem: 'problem.md', test: 'missing.py' }, files)
    expect(result).toBeNull()
  })

  it('problem/testがバイナリファイルの場合はnullを返す', () => {
    const binaryFiles: FileEntry[] = [
      { path: 'problem.md', content: { kind: 'binary', data: new Uint8Array(), mime: 'application/octet-stream' } },
      { path: 'test.py', content: { kind: 'text', data: 'def test_x(): assert True' } },
    ]
    const result = resolveExercise({ problem: 'problem.md', test: 'test.py' }, binaryFiles)
    expect(result).toBeNull()
  })
})
