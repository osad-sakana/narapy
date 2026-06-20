import { describe, it, expect } from 'vitest'
import {
  createObject,
  uniqueName,
  addObject,
  removeObject,
  updateScript,
  renameObject,
  findObject,
  setCostume,
  removeCostume,
  updateCostume,
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

describe('costume 操作', () => {
  it('setCostume は加工オフのコスチュームを付ける（不変）', () => {
    const objs = seed()
    const next = setCostume(objs, objs[0].id, 'data:image/png;base64,AAAA')
    expect(next[0].costume).toEqual({
      src: 'data:image/png;base64,AAAA',
      flipH: false,
      flipV: false,
      transparent: false,
    })
    expect(objs[0].costume).toBeUndefined()
  })

  it('updateCostume は src を保ったまま加工設定を部分更新する', () => {
    const base = seed()
    const objs = setCostume(base, base[0].id, 'x')
    const next = updateCostume(objs, base[0].id, { flipH: true, transparent: true })
    expect(next[0].costume).toMatchObject({ flipH: true, flipV: false, transparent: true, src: 'x' })
  })

  it('costume が無いオブジェクトに updateCostume は何もしない', () => {
    const objs = seed()
    const next = updateCostume(objs, objs[0].id, { flipH: true })
    expect(next[0].costume).toBeUndefined()
  })

  it('removeCostume はコスチュームを外す（矢印へ戻る）', () => {
    const base = seed()
    const withCostume = setCostume(base, base[0].id, 'x')
    const next = removeCostume(withCostume, base[0].id)
    expect(next[0].costume).toBeUndefined()
  })
})
