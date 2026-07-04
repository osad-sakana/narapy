import { describe, expect, it } from 'vitest'
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
})
