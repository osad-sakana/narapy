export interface NarapyProject {
  version: 1
  files: Array<{ name: string; content: string }>
  activeFile: string
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadPythonFile(code: string, filename = 'main.py'): void {
  triggerDownload(new Blob([code], { type: 'text/x-python' }), filename)
}

export function downloadNarapyProject(project: NarapyProject, filename = 'project.narapy'): void {
  const json = JSON.stringify(project, null, 2)
  triggerDownload(new Blob([json], { type: 'application/json' }), filename)
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

export function openNarapyFilePicker(
  onLoad: (project: NarapyProject) => void,
  onError: (message: string) => void,
): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.narapy'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const raw = e.target?.result
      if (typeof raw !== 'string') return
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!isNarapyProject(parsed)) {
          onError('無効な .narapy ファイルです')
          return
        }
        onLoad(parsed)
      } catch {
        onError('.narapy ファイルの読み込みに失敗しました')
      }
    }
    reader.readAsText(file, 'utf-8')
  })
  input.click()
}

function isNarapyProject(value: unknown): value is NarapyProject {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj['version'] !== 1) return false
  if (!Array.isArray(obj['files'])) return false
  if (typeof obj['activeFile'] !== 'string') return false
  return obj['files'].every(
    (f) =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as Record<string, unknown>)['name'] === 'string' &&
      typeof (f as Record<string, unknown>)['content'] === 'string',
  )
}
