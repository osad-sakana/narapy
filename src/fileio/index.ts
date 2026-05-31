export function downloadPythonFile(code: string, filename = 'main.py'): void {
  const blob = new Blob([code], { type: 'text/x-python' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function openFilePicker(onLoad: (code: string, filename: string) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.py'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') onLoad(result, file.name)
    }
    reader.readAsText(file, 'utf-8')
  })
  input.click()
}
