// コスチューム画像のデコード結果を name 単位でキャッシュする（メインスレッド）。
// src か透過設定が変わったときだけ画像を作り直し、反転だけの変更は再デコードしない。

import { decodeImage, makeTransparent } from './costume'
import type { CostumeView } from './renderer'
import type { GameObject, Costume } from './types'

export interface CostumeCache {
  // オブジェクト一覧に合わせてキャッシュを同期する（画像デコードを含むため非同期）。
  sync: (objects: readonly GameObject[]) => Promise<void>
  // 描画用に name で CostumeView を引く。
  get: (name: string) => CostumeView | undefined
}

// 画像の再デコードが必要かを表すキー（反転は含めない）。
function imageKey(costume: Costume): string {
  return `${costume.transparent ? 'T' : 'O'}|${costume.src}`
}

async function buildImage(costume: Costume): Promise<CanvasImageSource> {
  const img = await decodeImage(costume.src)
  return costume.transparent ? makeTransparent(img) : img
}

export function createCostumeCache(): CostumeCache {
  const entries = new Map<string, { key: string; view: CostumeView }>()

  async function sync(objects: readonly GameObject[]): Promise<void> {
    const live = new Set<string>()

    for (const obj of objects) {
      if (!obj.costume) continue
      live.add(obj.name)
      const key = imageKey(obj.costume)
      const existing = entries.get(obj.name)
      if (existing && existing.key === key) {
        // 反転だけ変わった場合は画像を作り直さずフラグのみ更新
        existing.view = {
          image: existing.view.image,
          flipH: obj.costume.flipH,
          flipV: obj.costume.flipV,
        }
        continue
      }
      const image = await buildImage(obj.costume)
      entries.set(obj.name, {
        key,
        view: { image, flipH: obj.costume.flipH, flipV: obj.costume.flipV },
      })
    }

    // コスチュームを失った/削除/改名されたオブジェクトのエントリを掃除
    for (const name of [...entries.keys()]) {
      if (!live.has(name)) entries.delete(name)
    }
  }

  function get(name: string): CostumeView | undefined {
    return entries.get(name)?.view
  }

  return { sync, get }
}
