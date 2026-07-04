import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchNarapyFromUrl, MAX_REMOTE_PROJECT_SIZE } from './fetchProject'

function buildNarapyArchiveBytes(): Uint8Array {
  const metadata = { version: 2, activeFile: 'main.py', directories: [] }
  return zipSync({
    'narapy.json': strToU8(JSON.stringify(metadata)),
    'files/main.py': strToU8('print("hello")'),
  })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buf).set(bytes)
  return buf
}

function mockFetchOnce(
  response: Partial<Response> & { arrayBuffer?: () => Promise<ArrayBuffer>; contentLength?: string | null },
): void {
  const headers = { get: (name: string) => (name.toLowerCase() === 'content-length' ? (response.contentLength ?? null) : null) }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ headers, ...response }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchNarapyFromUrl', () => {
  it('正常な.narapyアーカイブを取得して復元する', async () => {
    const bytes = buildNarapyArchiveBytes()
    mockFetchOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => toArrayBuffer(bytes),
    })
    const project = await fetchNarapyFromUrl('https://example.com/p.narapy')
    expect(project.activeFile).toBe('main.py')
  })

  it('fetch自体が失敗した場合(ネットワーク/CORS)はわかりやすいエラーになる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchNarapyFromUrl('https://example.com/p.narapy')).rejects.toThrow(/CORS|接続/)
  })

  it('HTTPエラー(404など)はステータスを含むエラーになる', async () => {
    mockFetchOnce({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })
    await expect(fetchNarapyFromUrl('https://example.com/missing.narapy')).rejects.toThrow(/404/)
  })

  it('サイズ上限を超える場合はエラーになる', async () => {
    const big = new ArrayBuffer(MAX_REMOTE_PROJECT_SIZE + 1)
    mockFetchOnce({ ok: true, status: 200, arrayBuffer: async () => big })
    await expect(fetchNarapyFromUrl('https://example.com/huge.narapy')).rejects.toThrow(/サイズ/)
  })

  it('不正な.narapy形式はパースエラーになる', async () => {
    const invalid = strToU8('not a zip')
    mockFetchOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => toArrayBuffer(invalid),
    })
    await expect(fetchNarapyFromUrl('https://example.com/broken.narapy')).rejects.toThrow(/解析/)
  })

  it('Content-Lengthが上限を超える場合はbodyを読む前にエラーになる', async () => {
    const arrayBuffer = vi.fn()
    mockFetchOnce({
      ok: true,
      status: 200,
      contentLength: String(MAX_REMOTE_PROJECT_SIZE + 1),
      arrayBuffer,
    })
    await expect(fetchNarapyFromUrl('https://example.com/huge.narapy')).rejects.toThrow(/サイズ/)
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('タイムアウト(AbortSignal.timeout)はタイムアウト用のメッセージになる', async () => {
    const timeoutError = new DOMException('signal timed out', 'TimeoutError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError))
    await expect(fetchNarapyFromUrl('https://example.com/slow.narapy')).rejects.toThrow(/タイムアウト/)
  })
})
