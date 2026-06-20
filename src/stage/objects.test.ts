import { describe, it, expect } from 'vitest'
import {
  createObject,
  uniqueName,
  addObject,
  removeObject,
  updateScript,
  renameObject,
  findObject,
} from './objects'
import type { GameObject } from './types'

function seed(): GameObject[] {
  return [createObject('player'), createObject('enemy')]
}

describe('uniqueName', () => {
  it('衝突しなければそのまま返す', () => {
    expect(uniqueName(seed(), 'ball')).toBe('ball')
  })

  it('衝突したら連番を付ける', () => {
    const objs = seed()
    expect(uniqueName(objs, 'player')).toBe('player2')
  })

  it('連番も衝突したら次の番号へ進む', () => {
    const objs = [createObject('player'), createObject('player2')]
    expect(uniqueName(objs, 'player')).toBe('player3')
  })
})

describe('addObject', () => {
  it('元の配列を変更せず新しい配列を返す（不変）', () => {
    const objs = seed()
    const next = addObject(objs, 'ball')
    expect(objs).toHaveLength(2)
    expect(next).toHaveLength(3)
    expect(next[2].name).toBe('ball')
  })

  it('重複名は自動でユニーク化される', () => {
    const next = addObject(seed(), 'player')
    expect(next[2].name).toBe('player2')
  })
})

describe('removeObject', () => {
  it('指定 id を除いた新しい配列を返す', () => {
    const objs = seed()
    const next = removeObject(objs, objs[0].id)
    expect(next).toHaveLength(1)
    expect(next[0].name).toBe('enemy')
    expect(objs).toHaveLength(2)
  })
})

describe('updateScript', () => {
  it('対象のみスクリプトを差し替える（不変）', () => {
    const objs = seed()
    const next = updateScript(objs, objs[0].id, 'print(1)')
    expect(next[0].script).toBe('print(1)')
    expect(next[1].script).toBe(objs[1].script)
    expect(objs[0].script).not.toBe('print(1)')
  })
})

describe('renameObject', () => {
  it('対象のみ名前を変える（不変）', () => {
    const objs = seed()
    const next = renameObject(objs, objs[1].id, 'boss')
    expect(next[1].name).toBe('boss')
    expect(objs[1].name).toBe('enemy')
  })
})

describe('findObject', () => {
  it('id でオブジェクトを返す', () => {
    const objs = seed()
    expect(findObject(objs, objs[0].id)?.name).toBe('player')
    expect(findObject(objs, 'missing')).toBeUndefined()
  })
})
