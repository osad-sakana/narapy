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

// issue #45 回帰: アクティブファイル削除時、退避先が「削除前にエディタが表示していたパス」で
// あれば残ったファイルの内容は破壊されない。main.ts の editorPath による不変条件回復と対になる。
describe('deleteFile (issue #45 回帰): アクティブファイル削除時の内容破壊防止', () => {
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

  it('削除前にエディタが表示していたパスへ退避すれば、切替先ファイルの内容は破壊されない', () => {
    const editorPathBeforeDelete = getActiveFile() // 'main.py' (削除前にエディタが表示していたパス)

    expect(deleteFile('main.py')).toBe(true)
    const switchedTo = getActiveFile() // 削除により 'sub.py' へ自動的に切り替わる

    // 削除済みのパスへ退避 → updateFileContent は対象が見つからず早期returnし、
    // 切り替え先ファイル(sub.py)の内容には一切影響しない
    updateFileContent(editorPathBeforeDelete, 'エディタ編集中の内容(未保存)')

    expect(switchedTo).toBe('sub.py')
    expect(getActiveContent()).toBe('サブの内容')
  })
})
