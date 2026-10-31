import type { RawCompletion } from './completionMeta'

const USER_MODULE = '__main__'
const BUILTINS_MODULE = 'builtins'

function isCallable(type: string): boolean {
  return type === 'function'
}

function describeModuleMember(owner: string, type: string): string {
  if (isCallable(type)) return `${owner}のメソッド`
  if (type === 'class') return `${owner}のクラス`
  return `${owner}のメンバ変数`
}

function describeUserDefined(raw: RawCompletion): string {
  if (raw.parentType === 'function') return '変数'
  if (isCallable(raw.type)) return '関数'
  if (raw.type === 'class') return 'クラス'
  return 'グローバル変数'
}

function describeFallback(type: string): string {
  if (isCallable(type)) return '関数'
  if (type === 'class') return 'クラス'
  if (type === 'instance' || type === 'statement') return '変数'
  return ''
}

// 補完候補の種別を初学者向けの日本語ラベルにする（先に一致した規則を採用）
export function describeCompletion(raw: RawCompletion): string {
  if (raw.type === 'keyword') return 'キーワード'
  if (raw.type === 'module') return 'モジュール'
  if (raw.type === 'param') return '引数'

  if (raw.parentType === 'class' && raw.parent !== '') {
    return isCallable(raw.type) ? `${raw.parent}のメソッド` : `${raw.parent}のメンバ変数`
  }
  if (raw.module === BUILTINS_MODULE) {
    if (isCallable(raw.type)) return '組み込み関数'
    if (raw.type === 'class') return '組み込みクラス'
  }
  if (raw.module === USER_MODULE) return describeUserDefined(raw)
  if (raw.module !== '' && raw.parentType === 'module') {
    return describeModuleMember(raw.module, raw.type)
  }
  return describeFallback(raw.type)
}
