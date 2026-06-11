import type { FileContent } from './types'
import { detectFileKind, guessMime, SUPPORTED_BINARY_EXT, SUPPORTED_TEXT_EXT } from './fileKind'
import { normalizePath } from './paths'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export interface UploadedFile {
  path: string
  content: FileContent
}

export interface UploadError {
  path: string
  message: string
}

export const SUPPORTED_EXTENSIONS = [...SUPPORTED_TEXT_EXT, ...SUPPORTED_BINARY_EXT]

export async function readBrowserFile(file: File, targetPath: string): Promise<UploadedFile> {
  const kind = detectFileKind(targetPath)
  if (kind === null) {
    throw new Error(`未対応の拡張子です: ${targetPath}`)
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`サイズ上限 (${formatBytes(MAX_FILE_SIZE)}) を超えています: ${targetPath}`)
  }

  if (kind === 'text') {
    const data = await file.text()
    return { path: targetPath, content: { kind: 'text', data } }
  }

  const buf = await file.arrayBuffer()
  const data = new Uint8Array(buf)
  const mime = file.type || guessMime(targetPath)
  return { path: targetPath, content: { kind: 'binary', data, mime } }
}

export function pickRelativePath(file: File, fallback: string): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (rel && rel.length > 0) return normalizePath(rel)
  return normalizePath(fallback)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export interface CollectedItem {
  file: File
  relPath: string
}

export async function collectFilesFromDataTransfer(items: DataTransferItemList): Promise<CollectedItem[]> {
  const collected: CollectedItem[] = []
  const tasks: Promise<void>[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const entry = (item as DataTransferItem & {
      webkitGetAsEntry?: () => FileSystemEntry | null
    }).webkitGetAsEntry?.()
    if (entry) {
      tasks.push(walkEntry(entry, '', collected))
    } else {
      const file = item.getAsFile()
      if (file) collected.push({ file, relPath: file.name })
    }
  }

  await Promise.all(tasks)
  return collected
}

interface FileSystemFileEntryLike extends FileSystemEntry {
  file: (cb: (f: File) => void, err?: (e: unknown) => void) => void
}
interface FileSystemDirectoryEntryLike extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReaderLike
}
interface FileSystemDirectoryReaderLike {
  readEntries: (cb: (entries: FileSystemEntry[]) => void, err?: (e: unknown) => void) => void
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: CollectedItem[]): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntryLike
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject)
    })
    out.push({ file, relPath: prefix ? `${prefix}/${entry.name}` : entry.name })
    return
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntryLike
    const reader = dirEntry.createReader()
    const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
      for (const sub of batch) {
        await walkEntry(sub, subPrefix, out)
      }
    } while (batch.length > 0)
  }
}
