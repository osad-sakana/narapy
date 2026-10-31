import { describe, expect, it } from 'vitest'
import { decideApply, type ApplyContext } from './decide'

const base: ApplyContext = {
  sameModel: true,
  sentVersion: 3,
  currentVersion: 3,
  readOnly: false,
  path: 'main.py',
  before: 'x=1\n',
  after: 'x = 1\n',
}

describe('decideApply', () => {
  it('条件が揃えば apply', () => {
    expect(decideApply(base)).toBe('apply')
  })

  it('モデルが変わっていたら stale', () => {
    expect(decideApply({ ...base, sameModel: false })).toBe('stale')
  })

  it('整形中に編集されたら stale', () => {
    expect(decideApply({ ...base, currentVersion: 4 })).toBe('stale')
  })

  it('読み取り専用なら skip', () => {
    expect(decideApply({ ...base, readOnly: true })).toBe('skip')
  })

  it('.py 以外は skip', () => {
    expect(decideApply({ ...base, path: 'data.csv' })).toBe('skip')
  })

  it('同一内容なら unchanged', () => {
    expect(decideApply({ ...base, after: base.before })).toBe('unchanged')
  })
})
