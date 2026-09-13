import { describe, expect, it } from 'vitest'
import { buildExerciseFromRows } from './buildExercise'
import { encodeProjectParam } from '../urlload/encode'
import { decodeProjectParam } from '../urlload/decode'

const rows = [
  { path: 'main.py', content: 'def add(a, b):\n    return a + b\n' },
  { path: 'problem.md', content: '# 足し算' },
  { path: 'test.py', content: 'def test_add():\n    assert add(1, 2) == 3\n' },
]

describe('buildExerciseFromRows', () => {
  it('exerciseメタデータ付きのNarapyProjectを組み立てる', () => {
    const project = buildExerciseFromRows(rows, 0, 1, 2)
    expect(project).toEqual({
      version: 2,
      files: [
        { path: 'main.py', content: { kind: 'text', data: 'def add(a, b):\n    return a + b\n' } },
        { path: 'problem.md', content: { kind: 'text', data: '# 足し算' } },
        { path: 'test.py', content: { kind: 'text', data: 'def test_add():\n    assert add(1, 2) == 3\n' } },
      ],
      directories: [],
      activeFile: 'main.py',
      exercise: { problem: 'problem.md', test: 'test.py' },
    })
  })

  it('問題文とテストが同じ行を指す場合はエラーになる', () => {
    expect(() => buildExerciseFromRows(rows, 0, 1, 1)).toThrow(/別のファイル/)
  })

  it('採点対象が問題文と同じ行を指す場合はエラーになる', () => {
    expect(() => buildExerciseFromRows(rows, 1, 1, 2)).toThrow(/採点対象/)
  })

  it('採点対象がテストと同じ行を指す場合はエラーになる', () => {
    expect(() => buildExerciseFromRows(rows, 2, 1, 2)).toThrow(/採点対象/)
  })

  it('問題文の行のパスが空の場合はエラーになる', () => {
    const withEmpty = [rows[0], { path: '  ', content: '' }, rows[2]]
    expect(() => buildExerciseFromRows(withEmpty, 0, 1, 2)).toThrow(/指定してください/)
  })

  it('buildProjectFromRowsの検証（パス重複等）もそのまま効く', () => {
    const duplicated = [rows[0], rows[1], { path: 'main.py', content: 'x' }]
    expect(() => buildExerciseFromRows(duplicated, 0, 1, 2)).toThrow(/重複/)
  })

  it('#project=用のencode/decodeを往復してもexerciseメタデータが保たれる(make-exercise実際のパイプライン)', () => {
    const project = buildExerciseFromRows(rows, 0, 1, 2)
    const restored = decodeProjectParam(encodeProjectParam(project))
    expect(restored).toEqual(project)
  })
})
