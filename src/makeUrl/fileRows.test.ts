import { describe, expect, it } from 'vitest'
import { addRow, removeRow, updateRow } from './fileRows'

describe('addRow', () => {
  it('末尾に空行を追加する(元の配列は変更しない)', () => {
    const rows = [{ path: 'main.py', content: '' }]
    const next = addRow(rows)
    expect(next).toEqual([{ path: 'main.py', content: '' }, { path: '', content: '' }])
    expect(rows).toEqual([{ path: 'main.py', content: '' }])
  })
})

describe('removeRow', () => {
  it('指定indexの行を取り除く', () => {
    const rows = [{ path: 'a.py', content: '1' }, { path: 'b.py', content: '2' }]
    expect(removeRow(rows, 0)).toEqual([{ path: 'b.py', content: '2' }])
  })
})

describe('updateRow', () => {
  it('指定indexの行だけを差分更新する(他の行はそのまま)', () => {
    const rows = [{ path: 'a.py', content: '1' }, { path: 'b.py', content: '2' }]
    const next = updateRow(rows, 1, { content: 'changed' })
    expect(next).toEqual([{ path: 'a.py', content: '1' }, { path: 'b.py', content: 'changed' }])
  })
})
