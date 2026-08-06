import { describe, expect, it } from 'vitest'
import { parseUrlLoadParams } from './params'

describe('parseUrlLoadParams', () => {
  it('何も指定がない場合はすべて未指定', () => {
    expect(parseUrlLoadParams('', '')).toEqual({})
  })

  it('#code= をhashから取得できる', () => {
    expect(parseUrlLoadParams('#code=abc', '')).toEqual({ code: 'abc' })
  })

  it('#project= をhashから取得できる', () => {
    expect(parseUrlLoadParams('#project=xyz', '')).toEqual({ project: 'xyz' })
  })

  it('?project=<URL> をsearchから取得できる (projectUrlとして区別)', () => {
    expect(parseUrlLoadParams('', '?project=https%3A%2F%2Fexample.com%2Fp.narapy'))
      .toEqual({ projectUrl: 'https://example.com/p.narapy' })
  })

  it('先頭に # や ? が付いていても付いていなくても解析できる', () => {
    expect(parseUrlLoadParams('code=abc', 'project=https://example.com/p.narapy'))
      .toEqual({ code: 'abc', projectUrl: 'https://example.com/p.narapy' })
  })

  it('hashとsearchが両方指定されていれば両方返す(優先順位の判断は呼び出し側の責務)', () => {
    expect(parseUrlLoadParams('#project=xyz', '?project=https://example.com/p.narapy'))
      .toEqual({ project: 'xyz', projectUrl: 'https://example.com/p.narapy' })
  })

  it('無関係なクエリパラメータが併存していても影響しない', () => {
    expect(parseUrlLoadParams('#code=abc', '?foo=1'))
      .toEqual({ code: 'abc' })
  })

  it('値が空文字のパラメータは未指定として扱う', () => {
    expect(parseUrlLoadParams('#code=', '')).toEqual({})
  })
})
