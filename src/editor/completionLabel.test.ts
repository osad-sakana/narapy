import { describe, expect, it } from 'vitest'
import { describeCompletion } from './completionLabel'
import type { RawCompletion } from './completionMeta'

function raw(partial: Partial<RawCompletion>): RawCompletion {
  return { name: 'x', type: '', module: '', parent: '', parentType: '', ...partial }
}

describe('describeCompletion', () => {
  const cases: Array<[string, Partial<RawCompletion>, string]> = [
    ['キーワード', { type: 'keyword' }, 'キーワード'],
    ['モジュール', { type: 'module' }, 'モジュール'],
    ['引数', { type: 'param' }, '引数'],
    ['他モジュールの関数', { type: 'function', module: 'random', parent: 'random', parentType: 'module' }, 'randomのメソッド'],
    ['他モジュールのクラス', { type: 'class', module: 'random', parent: 'random', parentType: 'module' }, 'randomのクラス'],
    ['他モジュールの変数', { type: 'instance', module: 'math', parent: 'math', parentType: 'module' }, 'mathのメンバ変数'],
    ['クラスのメソッド', { type: 'function', module: 'builtins', parent: 'str', parentType: 'class' }, 'strのメソッド'],
    ['クラスの属性', { type: 'instance', module: '__main__', parent: 'Dog', parentType: 'class' }, 'Dogのメンバ変数'],
    ['組み込み関数', { type: 'function', module: 'builtins', parent: 'builtins', parentType: 'module' }, '組み込み関数'],
    ['組み込みクラス', { type: 'class', module: 'builtins', parent: 'builtins', parentType: 'module' }, '組み込みクラス'],
    ['ユーザー関数', { type: 'function', module: '__main__', parent: '__main__', parentType: 'module' }, '関数'],
    ['ユーザークラス', { type: 'class', module: '__main__', parent: '__main__', parentType: 'module' }, 'クラス'],
    ['グローバル変数', { type: 'instance', module: '__main__', parent: '__main__', parentType: 'module' }, 'グローバル変数'],
    ['ローカル変数', { type: 'statement', module: '__main__', parent: 'f', parentType: 'function' }, '変数'],
    ['メタ情報なしの関数', { type: 'function' }, '関数'],
    ['メタ情報なしのクラス', { type: 'class' }, 'クラス'],
    ['メタ情報なしの変数', { type: 'instance' }, '変数'],
    ['未知の種別', { type: 'unknown' }, ''],
    ['空', {}, ''],
  ]

  it.each(cases)('%s', (_label, partial, expected) => {
    expect(describeCompletion(raw(partial))).toBe(expected)
  })
})
