import { strToU8, zlibSync } from 'fflate'
import { buildNarapyArchive, type NarapyProject } from '../fileio/index'
import { bytesToBase64Url } from './base64url'

// #code=<zlib圧縮 + base64url化された単一Pythonコード> を生成する(issue #32, /make-url用)
export function encodeCodeParam(source: string): string {
  return bytesToBase64Url(zlibSync(strToU8(source), { level: 9 }))
}

// #project=<zlib圧縮 + base64url化された.narapyアーカイブ> を生成する(issue #32, /make-url用)
export function encodeProjectParam(project: NarapyProject): string {
  return bytesToBase64Url(zlibSync(buildNarapyArchive(project), { level: 9 }))
}
