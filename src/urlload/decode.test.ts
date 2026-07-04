import { strToU8, zipSync, zlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { bytesToBase64Url } from './base64url'
import { decodeCodeParam, decodeProjectParam } from './decode'

function encodeCodeParamForTest(source: string): string {
  return bytesToBase64Url(zlibSync(strToU8(source), { level: 9 }))
}

function buildNarapyArchiveBytes(): Uint8Array {
  const metadata = { version: 2, activeFile: 'main.py', directories: [] }
  return zipSync({
    'narapy.json': strToU8(JSON.stringify(metadata)),
    'files/main.py': strToU8('print("hello")'),
  })
}

function encodeProjectParamForTest(archiveBytes: Uint8Array): string {
  return bytesToBase64Url(zlibSync(archiveBytes, { level: 9 }))
}

describe('decodeCodeParam', () => {
  it('圧縮されたPythonコードを単一ファイルプロジェクトとして復元する', () => {
    const encoded = encodeCodeParamForTest('print("hi")')
    const project = decodeCodeParam(encoded)
    expect(project.activeFile).toBe('main.py')
    expect(project.files).toEqual([{ path: 'main.py', content: { kind: 'text', data: 'print("hi")' } }])
    expect(project.directories).toEqual([])
  })

  it('不正なbase64url文字列はエラーになる', () => {
    expect(() => decodeCodeParam('!!!not-valid!!!')).toThrow()
  })
})

describe('decodeProjectParam', () => {
  it('圧縮された.narapyアーカイブを複数ファイルプロジェクトとして復元する', () => {
    const encoded = encodeProjectParamForTest(buildNarapyArchiveBytes())
    const project = decodeProjectParam(encoded)
    expect(project.activeFile).toBe('main.py')
    expect(project.files).toEqual([{ path: 'main.py', content: { kind: 'text', data: 'print("hello")' } }])
  })

  it('不正なbase64url文字列はエラーになる', () => {
    expect(() => decodeProjectParam('!!!not-valid!!!')).toThrow()
  })

  it('展開後のバイト列が.narapy形式でない場合はエラーになる', () => {
    const encoded = bytesToBase64Url(zlibSync(strToU8('not a zip'), { level: 9 }))
    expect(() => decodeProjectParam(encoded)).toThrow()
  })
})
