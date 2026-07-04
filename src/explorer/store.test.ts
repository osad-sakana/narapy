import { beforeEach, describe, expect, it } from 'vitest'
import { createTextFile, createDirectory, hasUserContent, loadProject, updateFileContent } from './store'

// state はモジュール単位のシングルトンなので、各テスト前にデフォルト状態へ明示的に戻す。
describe('hasUserContent', () => {
  beforeEach(() => {
    loadProject([{ path: 'main.py', content: { kind: 'text', data: '' } }], [], 'main.py')
  })

  it('デフォルト状態 (空のmain.pyのみ) ではfalse', () => {
    expect(hasUserContent()).toBe(false)
  })

  it('main.pyに内容があればtrue', () => {
    updateFileContent('main.py', 'print(1)')
    expect(hasUserContent()).toBe(true)
  })

  it('ファイルが追加されていればtrue', () => {
    createTextFile('sub.py', '')
    expect(hasUserContent()).toBe(true)
  })

  it('ディレクトリが追加されていればtrue', () => {
    createDirectory('assets')
    expect(hasUserContent()).toBe(true)
  })
})
