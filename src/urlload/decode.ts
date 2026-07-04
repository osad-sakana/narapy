import { strFromU8, unzlibSync } from 'fflate'
import { parseNarapyArchive, type NarapyProject } from '../fileio/index'
import { base64UrlToBytes } from './base64url'

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// #code=<zlib圧縮 + base64url化された単一Pythonコード> を復元する(issue #32)
export function decodeCodeParam(value: string): NarapyProject {
  try {
    const source = strFromU8(unzlibSync(base64UrlToBytes(value)))
    return {
      version: 2,
      files: [{ path: 'main.py', content: { kind: 'text', data: source } }],
      directories: [],
      activeFile: 'main.py',
    }
  } catch (err) {
    throw new Error(`#code の読み込みに失敗しました: ${toMessage(err)}`)
  }
}

// #project=<zlib圧縮 + base64url化された.narapyアーカイブ> を復元する(issue #32)
export function decodeProjectParam(value: string): NarapyProject {
  try {
    const archiveBytes = unzlibSync(base64UrlToBytes(value))
    return parseNarapyArchive(archiveBytes)
  } catch (err) {
    throw new Error(`#project の読み込みに失敗しました: ${toMessage(err)}`)
  }
}
