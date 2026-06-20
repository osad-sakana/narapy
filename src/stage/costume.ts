// コスチューム画像のユーティリティ。すべてメインスレッドで完結する。

// 白に近いとみなす閾値（各成分がこれ以上なら背景として透過）。
const WHITE_THRESHOLD = 240

// 読み込み可能な画像の最大バイト数（4MB）。
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

// 画像ファイルを data URL として読み込む。入力検証付き。
export async function fileToDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('対応していない画像形式です（PNG / JPEG / GIF / WebP / SVG）')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('画像が大きすぎます（最大 4MB）')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

// data URL から HTMLImageElement をデコードする。
export function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像をデコードできませんでした'))
    img.src = src
  })
}

// 白に近い背景を透過した画像を ImageBitmap として返す。
export async function makeTransparent(img: HTMLImageElement): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できません')

  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] >= WHITE_THRESHOLD && px[i + 1] >= WHITE_THRESHOLD && px[i + 2] >= WHITE_THRESHOLD) {
      px[i + 3] = 0
    }
  }
  ctx.putImageData(data, 0, 0)
  return createImageBitmap(canvas)
}
