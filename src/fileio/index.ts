import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

export function exportProjectAsNarapy(files: Record<string, string>): void {
  const entries = Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, strToU8(content)] as const),
  )
  const zipped = zipSync(entries)
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'project.narapy'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function openFilePicker(
  onPy: (code: string, filename: string) => void,
  onNarapy: (files: Record<string, string>) => void,
): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.py,.narapy'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    if (file.name.endsWith('.narapy')) {
      file.arrayBuffer().then((buffer) => {
        try {
          const unzipped = unzipSync(new Uint8Array(buffer))
          const pyFiles = Object.fromEntries(
            Object.entries(unzipped)
              .filter(([name]) => name.endsWith('.py') && !name.includes('/'))
              .map(([name, data]) => [name, strFromU8(data)]),
          )
          if (Object.keys(pyFiles).length > 0) {
            onNarapy(pyFiles)
          }
        } catch {
          window.alert('ファイルの読み込みに失敗しました。有効な .narapy ファイルか確認してください。')
        }
      }).catch(() => {
        window.alert('ファイルの読み込みに失敗しました。')
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') onPy(result, file.name)
    }
    reader.readAsText(file, 'utf-8')
  })
  input.click()
}
