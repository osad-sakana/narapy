import type { RawCompletion } from './completionMeta'

const USER_MODULE = '__main__'
const BUILTINS_MODULE = 'builtins'

function isFunction(type: string): boolean {
  return type === 'function'
}

// Issue #80 の表記に合わせ、モジュール／クラス所属の関数を「メソッド」、変数を「メンバ変数」と呼ぶ
function describeModuleMember(owner: string, type: string): string {
  if (isFunction(type)) return `${owner}のメソッド`
  if (type === 'class') return `${owner}のクラス`
  return `${owner}のメンバ変数`
}

function describeUserDefined(raw: RawCompletion): string {
  if (raw.parentType === 'function') return '変数'
  if (isFunction(raw.type)) return '関数'
  if (raw.type === 'class') return 'クラス'
  return 'グローバル変数'
}

function describeFallback(type: string): string {
  if (isFunction(type)) return '関数'
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
    return describeModuleMember(raw.parent, raw.type)
  }
  if (raw.module === BUILTINS_MODULE) {
    if (isFunction(raw.type)) return '組み込み関数'
    if (raw.type === 'class') return '組み込みクラス'
    if (raw.type === 'instance' || raw.type === 'statement') return '組み込み定数'
  }
  if (raw.module === USER_MODULE) return describeUserDefined(raw)
  if (raw.module !== '' && raw.parentType === 'module') {
    return describeModuleMember(raw.module, raw.type)
  }
  return describeFallback(raw.type)
}
