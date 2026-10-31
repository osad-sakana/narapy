import { describe, expect, it } from 'vitest'
import { describeOrigin } from './completionOrigin'
import type { RawCompletion } from './completionMeta'

const base: RawCompletion = {
  name: 'x', type: 'function', module: '', parent: '', parentType: '', line: 0, fullName: '',
}

describe('describeOrigin', () => {
  it('ユーザー定義は定義行', () => {
    expect(describeOrigin({ ...base, module: '__main__', line: 3 })).toBe('3行目で定義')
  })
  it('定義行が不明なら空', () => {
    expect(describeOrigin({ ...base, module: '__main__' })).toBe('')
  })
  it('解決できない import は import 元の完全名', () => {
    expect(describeOrigin({ ...base, type: 'module', module: '__main__', line: 1, fullName: 'pygame' })).toBe('pygame')
  })
  it('ユーザー定義の完全名（__main__.x）は定義行を優先', () => {
    expect(describeOrigin({ ...base, module: '__main__', line: 3, fullName: '__main__.greet' })).toBe('3行目で定義')
  })
  it('他モジュールは完全名', () => {
    expect(describeOrigin({ ...base, module: 'random', fullName: 'random.randint' })).toBe('random.randint')
  })
  it('組み込み', () => {
    expect(describeOrigin({ ...base, module: 'builtins', fullName: 'builtins.print' })).toBe('組み込み')
  })
  it('キーワード・引数は空', () => {
    expect(describeOrigin({ ...base, type: 'keyword', module: 'builtins' })).toBe('')
    expect(describeOrigin({ ...base, type: 'param', module: '__main__', line: 2 })).toBe('')
  })
})
