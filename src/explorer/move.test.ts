import { describe, it, expect } from 'vitest'
import { planMove } from './move'

const snapshot = {
  files: ['main.py', 'data/a.csv', 'data/csv/b.json', 'data2/x.txt', 'lib/util.py'],
  directories: ['data', 'data/csv', 'data2', 'lib', 'empty'],
}

describe('planMove: ファイル', () => {
  it('フォルダへ移動できる', () => {
    expect(planMove(snapshot, { type: 'file', path: 'main.py' }, 'lib')).toEqual({
      ok: true,
      fileMoves: [{ from: 'main.py', to: 'lib/main.py' }],
      dirMoves: [],
    })
  })

  it('ルート（空文字）へ移動できる', () => {
    const plan = planMove(snapshot, { type: 'file', path: 'data/a.csv' }, '')
    expect(plan).toEqual({ ok: true, fileMoves: [{ from: 'data/a.csv', to: 'a.csv' }], dirMoves: [] })
  })

  it('同じフォルダへの移動は same', () => {
    expect(planMove(snapshot, { type: 'file', path: 'data/a.csv' }, 'data')).toEqual({ ok: false, reason: 'same' })
    expect(planMove(snapshot, { type: 'file', path: 'main.py' }, '')).toEqual({ ok: false, reason: 'same' })
  })

  it('移動先に同名ファイルがあれば conflict', () => {
    const s = { ...snapshot, files: [...snapshot.files, 'lib/main.py'] }
    expect(planMove(s, { type: 'file', path: 'main.py' }, 'lib')).toEqual({ ok: false, reason: 'conflict' })
  })

  it('移動先に同名フォルダがあれば conflict', () => {
    const s = { files: ['lib', 'x/lib'], directories: ['x'] }
    expect(planMove(s, { type: 'file', path: 'x/lib' }, '')).toEqual({ ok: false, reason: 'conflict' })
  })

  it('存在しないファイルは not-found', () => {
    expect(planMove(snapshot, { type: 'file', path: 'nope.py' }, 'lib')).toEqual({ ok: false, reason: 'not-found' })
  })
})

describe('planMove: フォルダ', () => {
  it('配下のファイルとサブフォルダをまとめて移動する', () => {
    const plan = planMove(snapshot, { type: 'dir', path: 'data' }, 'lib')
    expect(plan).toEqual({
      ok: true,
      fileMoves: [
        { from: 'data/a.csv', to: 'lib/data/a.csv' },
        { from: 'data/csv/b.json', to: 'lib/data/csv/b.json' },
      ],
      dirMoves: [
        { from: 'data', to: 'lib/data' },
        { from: 'data/csv', to: 'lib/data/csv' },
      ],
    })
  })

  it('名前が前方一致するだけの別フォルダ(data2)は巻き込まない', () => {
    const plan = planMove(snapshot, { type: 'dir', path: 'data' }, 'lib')
    expect(plan.ok && plan.fileMoves.some(m => m.from.startsWith('data2'))).toBe(false)
  })

  it('空フォルダも移動できる', () => {
    expect(planMove(snapshot, { type: 'dir', path: 'empty' }, 'lib')).toEqual({
      ok: true,
      fileMoves: [],
      dirMoves: [{ from: 'empty', to: 'lib/empty' }],
    })
  })

  it('自分自身・子孫への移動は into-self', () => {
    expect(planMove(snapshot, { type: 'dir', path: 'data' }, 'data')).toEqual({ ok: false, reason: 'into-self' })
    expect(planMove(snapshot, { type: 'dir', path: 'data' }, 'data/csv')).toEqual({ ok: false, reason: 'into-self' })
  })

  it('前方一致するだけの別フォルダへは移動できる', () => {
    expect(planMove(snapshot, { type: 'dir', path: 'data' }, 'data2').ok).toBe(true)
  })

  it('現在の親フォルダへの移動は same', () => {
    expect(planMove(snapshot, { type: 'dir', path: 'data/csv' }, 'data')).toEqual({ ok: false, reason: 'same' })
  })

  it('移動先に同名フォルダがあれば conflict', () => {
    const s = { files: [], directories: ['a', 'b', 'b/a'] }
    expect(planMove(s, { type: 'dir', path: 'a' }, 'b')).toEqual({ ok: false, reason: 'conflict' })
  })

  it('存在しないフォルダは not-found', () => {
    expect(planMove(snapshot, { type: 'dir', path: 'ghost' }, 'lib')).toEqual({ ok: false, reason: 'not-found' })
  })
})
