import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { buildNarapyArchive, parseNarapyArchive, type NarapyProject } from './index'

describe('buildNarapyArchive / parseNarapyArchive', () => {
  it('組み立てたアーカイブを再度パースすると元のプロジェクトに戻る', () => {
    const project: NarapyProject = {
      version: 2,
      files: [
        { path: 'main.py', content: { kind: 'text', data: 'print(1)' } },
        { path: 'util.py', content: { kind: 'text', data: 'def f(): pass' } },
      ],
      directories: [],
      activeFile: 'main.py',
    }
    const archive = buildNarapyArchive(project)
    const restored = parseNarapyArchive(archive)
    expect(restored).toEqual(project)
  })

  it('exerciseメタデータ付き(.exercise)も往復できる(issue #65)', () => {
    const project: NarapyProject = {
      version: 2,
      files: [
        { path: 'main.py', content: { kind: 'text', data: 'def add(a, b):\n    return a + b\n' } },
        { path: 'problem.md', content: { kind: 'text', data: '# 足し算\n2つの数を足す関数を書いてください。' } },
        { path: 'test.py', content: { kind: 'text', data: 'def test_add():\n    assert add(1, 2) == 3\n' } },
      ],
      directories: [],
      activeFile: 'main.py',
      exercise: { problem: 'problem.md', test: 'test.py' },
    }
    const archive = buildNarapyArchive(project)
    const restored = parseNarapyArchive(archive)
    expect(restored).toEqual(project)
  })

  it('exerciseメタデータが無ければ通常の.narapyプロジェクトとして扱われる', () => {
    const project: NarapyProject = {
      version: 2,
      files: [{ path: 'main.py', content: { kind: 'text', data: 'print(1)' } }],
      directories: [],
      activeFile: 'main.py',
    }
    const restored = parseNarapyArchive(buildNarapyArchive(project))
    expect(restored.exercise).toBeUndefined()
  })

  it('exerciseの形が不正な場合はメタデータエラーとして拒否する', () => {
    const archive: Record<string, Uint8Array> = {
      'narapy.json': strToU8(JSON.stringify({
        version: 2,
        activeFile: 'main.py',
        directories: [],
        exercise: { problem: 'problem.md' }, // testフィールドが欠けている
      })),
      'files/main.py': strToU8('print(1)'),
    }
    const bytes = zipSync(archive)
    expect(() => parseNarapyArchive(bytes)).toThrow('メタデータの形式が不正です')
  })
})
