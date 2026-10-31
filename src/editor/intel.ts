// hover / 引数ヘルプ用: Worker の jedi 応答の検証と Monaco 向け整形（Monaco を import しない純関数）

import { lookupJaDoc, lookupJaParam, type JaDoc } from './jaDocs'

export type HoverInfo = {
  name: string
  fullName: string
  type: string
  signature: string
  doc: string
  description: string
}

export type SignatureInfo = {
  name: string
  fullName: string
  params: string[]
  // いま入力中の引数の位置。不明は -1
  index: number
  doc: string
}

// completion_helper.py の _DOC_MAX と同じ値に保つこと
export const DOC_MAX_CHARS = 4000
const SIGNATURES_MAX = 5
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
    fullName: str(rec.fullName, FIELD_MAX_CHARS),
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
  return {
    name: rec.name.slice(0, FIELD_MAX_CHARS),
    fullName: str(rec.fullName, FIELD_MAX_CHARS),
    params,
    index,
    doc: str(rec.doc, DOC_MAX_CHARS),
  }
}

export type SignatureHelpInfo = {
  signatures: SignatureInfo[]
  // 最初に開くオーバーロード（入力中の引数位置が特定できたもの）
  active: number
}

export function parseSignatureHelp(value: unknown): SignatureHelpInfo | null {
  const rec = asRecord(value)
  if (!rec || !Array.isArray(rec.signatures)) return null
  const signatures = rec.signatures
    .slice(0, SIGNATURES_MAX)
    .map(parseSignatureInfo)
    .filter((sig): sig is SignatureInfo => sig !== null)
  if (signatures.length === 0) return null
  const active =
    typeof rec.active === 'number' && Number.isInteger(rec.active) && rec.active >= 0 && rec.active < signatures.length
      ? rec.active
      : 0
  return { signatures, active }
}

// docstring をコードフェンスで囲んで改行・インデントを保つ。本文中の ``` は無害化する
function fenced(lang: string, text: string): string {
  return `\`\`\`${lang}\n${text.replace(/```/g, "'''")}\n\`\`\``
}

export function signatureDocMarkdown(doc: string): string | undefined {
  return doc === '' ? undefined : fenced('text', doc)
}

// シグネチャに実際に出てくる引数だけを列挙する（別のオーバーロードや内部名を出さない）。
// シグネチャが無いときは辞書の全引数を出す
function jaParamList(params: JaDoc['params'], signature: string): string {
  return Object.entries(params ?? {})
    .filter(([name]) => signature === '' || new RegExp(`[(\\s,*]${name}\\s*[:,)=]`).test(signature))
    .map(([name, text]) => `- \`${name}\`: ${text}`)
    .join('\n')
}

export function hoverMarkdown(info: HoverInfo): string {
  const head = info.signature || info.description || info.name
  const ja = lookupJaDoc(info.fullName)
  const parts = [fenced('python', head)]
  if (ja) {
    parts.push(ja.summary)
    const list = jaParamList(ja.params, info.signature)
    if (list !== '') parts.push(list)
  }
  if (info.doc !== '') parts.push(fenced('text', info.doc))
  return parts.join('\n\n')
}

export type SignatureView = {
  label: string
  parameters: Array<{ range: [number, number]; documentation?: string }>
  // 日本語の要約（辞書にあれば）に続けて英語の docstring を出す
  documentation?: string
}

export function describeSignature(info: SignatureInfo): SignatureView {
  const { label, parameters } = signatureLabel(info)
  const ja = lookupJaDoc(info.fullName)
  const docs = [ja?.summary, signatureDocMarkdown(info.doc)].filter((d): d is string => d !== undefined)
  return {
    label,
    parameters: parameters.map((range, i) => ({ range, documentation: lookupJaParam(ja, info.params[i]) })),
    documentation: docs.length === 0 ? undefined : docs.join('\n\n'),
  }
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
