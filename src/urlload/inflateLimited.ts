import { Unzlib } from 'fflate'

// URLの #code= / #project= は第三者が作れるため、展開後サイズを先に制限する(zlib bomb 対策)。
// unzlibSync は全量を展開してからでないと長さが分からず、数百KBで数百MBに膨らむ。
export function unzlibLimited(data: Uint8Array, maxSize: number): Uint8Array {
  const chunks: Uint8Array[] = []
  let total = 0
  const inflater = new Unzlib(chunk => {
    total += chunk.length
    if (total > maxSize) {
      throw new Error(`展開後のサイズが上限 (${Math.floor(maxSize / 1024)} KB) を超えています`)
    }
    chunks.push(chunk)
  })
  inflater.push(data, true)

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}
