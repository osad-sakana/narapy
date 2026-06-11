import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import type { FileEntry, DirectoryEntry } from '../explorer/types'
import { detectFileKind, guessMime } from '../explorer/fileKind'

export interface NarapyProject {
  version: 2
  files: FileEntry[]
  directories: DirectoryEntry[]
  activeFile: string
}

interface NarapyMetadataV2 {
  version: 2
  activeFile: string
  directories: string[]
}

interface NarapyMetadataV1 {
  version: 1
  activeFile: string
  files: Array<{ name: string; content: string }>
}

const META_FILENAME = 'narapy.json'
const FILES_PREFIX = 'files/'

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadNarapyProject(project: NarapyProject, filename = 'project.narapy'): void {
  const archive: Record<string, Uint8Array> = {}

  const metadata: NarapyMetadataV2 = {
    version: 2,
    activeFile: project.activeFile,
    directories: project.directories.map(d => d.path),
  }
  archive[META_FILENAME] = strToU8(JSON.stringify(metadata, null, 2))

  for (const file of project.files) {
    const key = `${FILES_PREFIX}${file.path}`
    if (file.content.kind === 'text') {
      archive[key] = strToU8(file.content.data)
    } else {
      archive[key] = file.content.data
    }
  }

  const zipped = zipSync(archive, { level: 6 })
  triggerDownload(new Blob([zipped], { type: 'application/zip' }), filename)
}

export function openNarapyFilePicker(
  onLoad: (project: NarapyProject) => void,
  onError: (message: string) => void,
): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.narapy'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const data = new Uint8Array(buf)
      const project = parseNarapyArchive(data)
      onLoad(project)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      onError(`.narapy ファイルの読み込みに失敗しました: ${message}`)
    }
  })
  input.click()
}

function parseNarapyArchive(data: Uint8Array): NarapyProject {
  // v1 (旧): プレーン JSON
  if (looksLikeJson(data)) {
    return parseLegacyJson(strFromU8(data))
  }

  const entries = unzipSync(data)
  const metaBytes = entries[META_FILENAME]
  if (!metaBytes) {
    throw new Error(`${META_FILENAME} が見つかりません`)
  }

  const metaRaw = JSON.parse(strFromU8(metaBytes)) as unknown
  if (!isMetaV2(metaRaw)) {
    throw new Error('メタデータの形式が不正です')
  }

  const files: FileEntry[] = []
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith(FILES_PREFIX)) continue
    if (name.endsWith('/')) continue
    const path = name.slice(FILES_PREFIX.length)
    const kind = detectFileKind(path)
    if (kind === 'text') {
      files.push({ path, content: { kind: 'text', data: strFromU8(bytes) } })
    } else if (kind === 'binary') {
      files.push({
        path,
        content: { kind: 'binary', data: bytes, mime: guessMime(path) },
      })
    } else {
      // 未知拡張子はバイナリとして取り込む（ベストエフォート）
      files.push({
        path,
        content: { kind: 'binary', data: bytes, mime: 'application/octet-stream' },
      })
    }
  }

  return {
    version: 2,
    files,
    directories: metaRaw.directories.map(p => ({ path: p })),
    activeFile: metaRaw.activeFile,
  }
}

function looksLikeJson(data: Uint8Array): boolean {
  // 先頭の空白をスキップして '{' から始まるかを判定
  for (let i = 0; i < Math.min(data.length, 16); i++) {
    const c = data[i]
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) continue
    return c === 0x7b // '{'
  }
  return false
}

function parseLegacyJson(raw: string): NarapyProject {
  const parsed = JSON.parse(raw) as unknown
  if (!isMetaV1(parsed)) {
    throw new Error('旧形式 (v1) の形式が不正です')
  }
  const files: FileEntry[] = parsed.files.map(f => ({
    path: f.name,
    content: { kind: 'text' as const, data: f.content },
  }))
  return {
    version: 2,
    files,
    directories: [],
    activeFile: parsed.activeFile,
  }
}

function isMetaV2(value: unknown): value is NarapyMetadataV2 {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj['version'] !== 2) return false
  if (typeof obj['activeFile'] !== 'string') return false
  if (!Array.isArray(obj['directories'])) return false
  return obj['directories'].every(d => typeof d === 'string')
}

function isMetaV1(value: unknown): value is NarapyMetadataV1 {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj['version'] !== 1) return false
  if (typeof obj['activeFile'] !== 'string') return false
  if (!Array.isArray(obj['files'])) return false
  return obj['files'].every(f =>
    typeof f === 'object' && f !== null &&
    typeof (f as Record<string, unknown>)['name'] === 'string' &&
    typeof (f as Record<string, unknown>)['content'] === 'string')
}

