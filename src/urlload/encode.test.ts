import { describe, expect, it } from 'vitest'
import type { NarapyProject } from '../fileio/index'
import { decodeCodeParam, decodeProjectParam } from './decode'
import { encodeCodeParam, encodeProjectParam } from './encode'

describe('encodeCodeParam', () => {
  it('decodeCodeParamと往復できる', () => {
    const source = 'print("hello")\nfor i in range(3):\n    print(i)'
    const encoded = encodeCodeParam(source)
    const project = decodeCodeParam(encoded)
    expect(project.files).toEqual([{ path: 'main.py', content: { kind: 'text', data: source } }])
    expect(project.activeFile).toBe('main.py')
  })

  it('空文字コードも往復できる', () => {
    const encoded = encodeCodeParam('')
    expect(decodeCodeParam(encoded).files[0].content).toEqual({ kind: 'text', data: '' })
  })
})

describe('encodeProjectParam', () => {
  it('decodeProjectParamと往復できる(複数ファイル)', () => {
    const project: NarapyProject = {
      version: 2,
      files: [
        { path: 'main.py', content: { kind: 'text', data: 'from util import greet\nprint(greet())' } },
        { path: 'util.py', content: { kind: 'text', data: 'def greet():\n    return "hi"' } },
      ],
      directories: [],
      activeFile: 'main.py',
    }
    const encoded = encodeProjectParam(project)
    const restored = decodeProjectParam(encoded)
    expect(restored).toEqual(project)
  })
})
