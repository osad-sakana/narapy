import { beforeEach, describe, expect, it } from 'vitest'
import { createTextFile, createDirectory, deleteFile, getActiveContent, getActiveFile, hasUserContent, loadProject, updateFileContent } from './store'

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

// updateFileContent の契約確認: 削除済み(=存在しない)パスへの書き込みは早期returnでno-opになる。
// これは main.ts の実行前同期・エクスポート前同期が editorPath を宛先に書き込む際、
// editorPath が削除済みファイルを指していても安全である根拠となる store 側の性質。
// （アクティブファイル削除後のフォールバックがバイナリだと setActiveFile が false を返し、
// switchToFile が早期returnするため editorPath は削除済みパスのまま残りうる）
// ファイル切替まわりの回帰シナリオ検証は src/editor/fileSwitcher.test.ts で行っている。
describe('updateFileContent: 存在しないパスへの書き込みはno-op', () => {
  beforeEach(() => {
    loadProject(
      [
        { path: 'main.py', content: { kind: 'text', data: 'メインの内容' } },
        { path: 'sub.py', content: { kind: 'text', data: 'サブの内容' } },
      ],
      [],
      'main.py',
    )
  })

  it('削除済みのパスへ書き込んでも、他のファイルの内容には一切影響しない', () => {
    expect(deleteFile('main.py')).toBe(true)

    updateFileContent('main.py', '削除済みファイルへの書き込み')

    expect(getActiveFile()).toBe('sub.py')
    expect(getActiveContent()).toBe('サブの内容')
  })
})
