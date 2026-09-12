import { describe, expect, it } from 'vitest'
import { diffVars } from './varDiff'
import type { TraceVar } from './types'

function v(name: string, value: string, type = 'int'): TraceVar {
  return { name, type, value }
}

describe('diffVars', () => {
  it('previous が null の場合は全て added になる', () => {
    const result = diffVars(null, [v('x', '1'), v('y', '2')])
    expect(result.map(r => r.change)).toEqual(['added', 'added'])
  })

  it('新規に現れた変数は added になる', () => {
    const result = diffVars([v('x', '1')], [v('x', '1'), v('y', '2')])
    expect(result.find(r => r.name === 'y')?.change).toBe('added')
  })

  it('値が変わった変数は changed になる', () => {
    const result = diffVars([v('x', '1')], [v('x', '2')])
    expect(result.find(r => r.name === 'x')?.change).toBe('changed')
  })

  it('値が同じ変数は unchanged になる', () => {
    const result = diffVars([v('x', '1')], [v('x', '1')])
    expect(result.find(r => r.name === 'x')?.change).toBe('unchanged')
  })

  it('previous に存在しても current に無い変数は結果に含まれない', () => {
    const result = diffVars([v('x', '1'), v('y', '2')], [v('x', '1')])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('x')
  })

  it('current が空の場合は空配列を返す', () => {
    expect(diffVars([v('x', '1')], [])).toEqual([])
  })
})
