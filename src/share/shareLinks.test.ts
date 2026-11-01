import { describe, expect, it } from 'vitest'
import { buildCodeLink, buildProjectLink, currentBaseUrl, MAX_SHARE_URL_LENGTH, pickCodeTarget, type ShareState } from './shareLinks'
import { decodeCodeParam, decodeProjectParam } from '../urlload/decode'

// 圧縮が効かない疑似乱数列(LCG)
function noisyBytes(n: number): Uint8Array {
  let x = 12345
  return Uint8Array.from({ length: n }, () => { x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff; return (x >> 16) & 0xff })
}

const BASE = 'https://example.com/app/'
const state = (over: Partial<ShareState> = {}): ShareState => ({
  files: [
    { path: 'main.py', content: { kind: 'text', data: 'print("hi")' } },
    { path: 'util.py', content: { kind: 'text', data: 'x = 1' } },
  ],
  directories: [],
  activeFile: 'util.py',
  ...over,
})

describe('currentBaseUrl', () => {
  it('オリジン+パスだけを返す', () => {
    expect(currentBaseUrl({ origin: 'https://a.test', pathname: '/x/' })).toBe('https://a.test/x/')
  })
})

describe('pickCodeTarget', () => {
  it('main.py があれば優先する', () => expect(pickCodeTarget(state())?.path).toBe('main.py'))
  it('無ければアクティブなテキストファイル', () => {
    const s = state({ files: [{ path: 'a.py', content: { kind: 'text', data: '1' } }], activeFile: 'a.py' })
    expect(pickCodeTarget(s)?.path).toBe('a.py')
  })
  it('対象が無ければ undefined', () => {
    const s = state({ files: [{ path: 'a.png', content: { kind: 'binary', data: new Uint8Array(1), mime: 'image/png' } }], activeFile: 'a.png' })
    expect(pickCodeTarget(s)).toBeUndefined()
  })
})

describe('buildCodeLink', () => {
  it('#code= を生成し、復号すると元のコードに戻る', () => {
    const r = buildCodeLink(BASE, state())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.url.startsWith(`${BASE}#code=`)).toBe(true)
    expect(decodeCodeParam(r.url.split('#code=')[1]).files[0].content).toEqual({ kind: 'text', data: 'print("hi")' })
  })
  it('対象が無ければ noTarget', () => {
    expect(buildCodeLink(BASE, state({ files: [], activeFile: '' }))).toEqual({ ok: false, reason: 'noTarget' })
  })
  it('上限を超えると tooLong', () => {
    const noise = Array.from(noisyBytes(60000), b => b.toString(16)).join('')
    const r = buildCodeLink(BASE, state({ files: [{ path: 'main.py', content: { kind: 'text', data: noise } }] }))
    expect(r).toMatchObject({ ok: false, reason: 'tooLong' })
    if (!r.ok && r.reason === 'tooLong') expect(r.length).toBeGreaterThan(MAX_SHARE_URL_LENGTH)
  })
})

describe('buildProjectLink', () => {
  it('#project= を生成し、復号すると全ファイルとアクティブファイルが戻る', () => {
    const r = buildProjectLink(BASE, state())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const project = decodeProjectParam(r.url.split('#project=')[1])
    expect(project.files.map(f => f.path)).toEqual(['main.py', 'util.py'])
    expect(project.activeFile).toBe('util.py')
    expect(project.exercise).toBeUndefined()
  })
  it('バイナリを含めて上限を超えると tooLong', () => {
    const big = noisyBytes(100_000)
    const r = buildProjectLink(BASE, state({ files: [{ path: 'a.png', content: { kind: 'binary', data: big, mime: 'image/png' } }] }))
    expect(r).toMatchObject({ ok: false, reason: 'tooLong' })
  })
})
