export interface FileRowState {
  path: string
  content: string
}

export function addRow(rows: FileRowState[]): FileRowState[] {
  return [...rows, { path: '', content: '' }]
}

export function removeRow(rows: FileRowState[], index: number): FileRowState[] {
  return rows.filter((_, i) => i !== index)
}

export function updateRow(rows: FileRowState[], index: number, patch: Partial<FileRowState>): FileRowState[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
}
