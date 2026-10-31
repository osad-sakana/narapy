// hover / 引数ヘルプ用: Worker の jedi 応答の検証と Monaco 向け整形（Monaco を import しない純関数）

export type HoverInfo = {
  name: string
  type: string
  signature: string
  doc: string
  description: string
}

export type SignatureInfo = {
  name: string
  params: string[]
  // いま入力中の引数の位置。不明は -1
  index: number
  doc: string
}

export const DOC_MAX_CHARS = 4000
const FIELD_MAX_CHARS = 300

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export function parseHoverInfo(value: unknown): HoverInfo | null {
  const rec = asRecord(value)
  if (!rec || typeof rec.name !== 'string' || rec.name === '') return null
  return {
    name: rec.name.slice(0, FIELD_MAX_CHARS),
    type: str(rec.type, FIELD_MAX_CHARS),
    signature: str(rec.signature, FIELD_MAX_CHARS),
    doc: str(rec.doc, DOC_MAX_CHARS),
    description: str(rec.description, FIELD_MAX_CHARS),
  }
}

export function parseSignatureInfo(value: unknown): SignatureInfo | null {
  const rec = asRecord(value)
  if (!rec || typeof rec.name !== 'string' || rec.name === '') return null
  const params = Array.isArray(rec.params)
    ? rec.params.filter((p): p is string => typeof p === 'string').map((p) => p.slice(0, FIELD_MAX_CHARS))
    : []
  const index = typeof rec.index === 'number' && Number.isInteger(rec.index) && rec.index >= 0 ? rec.index : -1
  return { name: rec.name.slice(0, FIELD_MAX_CHARS), params, index, doc: str(rec.doc, DOC_MAX_CHARS) }
}

// docstring をコードフェンスで囲んで改行・インデントを保つ。本文中の ``` は無害化する
function fenced(lang: string, text: string): string {
  return `\`\`\`${lang}\n${text.replace(/```/g, "'''")}\n\`\`\``
}

export function hoverMarkdown(info: HoverInfo): string {
  const head = info.signature || info.description || info.name
  const parts = [fenced('python', head)]
  if (info.doc !== '') parts.push(fenced('text', info.doc))
  return parts.join('\n\n')
}

export function signatureLabel(info: SignatureInfo): { label: string; parameters: Array<[number, number]> } {
  let label = `${info.name}(`
  const parameters: Array<[number, number]> = []
  info.params.forEach((param, i) => {
    if (i > 0) label += ', '
    parameters.push([label.length, label.length + param.length])
    label += param
  })
  return { label: `${label})`, parameters }
}
