import { describe, expect, it, vi } from 'vitest'
import { createFileOpener, createModelRegistry, type ManagedModel } from './modelRegistry'

// Monaco の ITextModel を模したテストダブル。エディタ上での編集は setValue で模す。
interface FakeModel extends ManagedModel {
  disposed: boolean
  setValue: (value: string) => void
}

function createFakeHost() {
  const created: FakeModel[] = []
  const attached: FakeModel[] = []
  const host = {
    createModel: (content: string): FakeModel => {
      let value = content
      const model: FakeModel = {
        disposed: false,
        getValue: () => value,
        setValue: (next: string) => { value = next },
        dispose: () => { model.disposed = true },
      }
      created.push(model)
      return model
    },
    setModel: (model: FakeModel) => { attached.push(model) },
  }
  return { host, created, current: () => attached[attached.length - 1] }
}

describe('createModelRegistry', () => {
  it('別ファイルへ切り替えて戻ると同じモデルが再利用される（ファイル別undo履歴の保持）', () => {
    const { host, created, current } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', 'Aの内容')
    const modelA = current()
    registry.openFile('b.py', 'Bの内容')
    registry.openFile('a.py', 'Aの内容')

    expect(current()).toBe(modelA)
    expect(created).toHaveLength(2)
    expect(modelA.disposed).toBe(false)
  })

  it('ストア内容がモデルとずれている場合はモデルを作り直して破棄する', () => {
    const { host, created, current } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', '元の内容')
    const stale = current()
    registry.openFile('b.py', 'Bの内容')
    // アップロード等でストアだけが書き換わったケース
    registry.openFile('a.py', '外部から上書きされた内容')

    expect(current()).not.toBe(stale)
    expect(stale.disposed).toBe(true)
    expect(created).toHaveLength(3)
  })

  it('同一パスを開き直すときも、ストア内容とずれていればモデルを作り直す', () => {
    const { host, current } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', '元の内容')
    const before = current()
    // アップロードで表示中のファイルが外部から上書きされたケース
    registry.openFile('a.py', '外部から上書きされた内容')

    expect(current()).not.toBe(before)
    // 表示中だったモデルは差し替え後に破棄される
    expect(before.disposed).toBe(true)
  })

  it("mode 'reset' は全モデルを破棄する（プロジェクト読込）", () => {
    const { host, created, current } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', 'Aの内容')
    registry.openFile('b.py', 'Bの内容')
    const [modelA, modelB] = created

    // 読込後の内容が読込前と一致していてもモデルは作り直される
    registry.openFile('a.py', 'Aの内容', 'reset')

    expect(modelA.disposed).toBe(true)
    expect(modelB.disposed).toBe(true)
    expect(current()).not.toBe(modelA)
    expect(registry.getOpenPaths()).toEqual(['a.py'])
  })

  it('prune はストアに存在しないパスのモデルを破棄する', () => {
    const { host, created } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', 'Aの内容')
    registry.openFile('b.py', 'Bの内容')
    const [modelA] = created

    registry.prune(['b.py'])

    expect(modelA.disposed).toBe(true)
    expect(registry.getOpenPaths()).toEqual(['b.py'])
  })

  it('prune で破棄されたファイルと同名のファイルを開くと新しいモデルになる', () => {
    const { host, created, current } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', '')
    registry.openFile('b.py', 'Bの内容')
    const deleted = created[0]

    // a.py が削除された後、同名ファイルを新規作成して開く（内容は偶然一致する空文字）
    registry.prune(['b.py'])
    registry.openFile('a.py', '')

    expect(current()).not.toBe(deleted)
    expect(deleted.disposed).toBe(true)
  })

  it('表示中のモデルは破棄が差し替え後まで遅延される', () => {
    const { host, created } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', 'Aの内容')
    const attachedModel = created[0]

    // 表示中のファイルが削除されたケース
    registry.prune([])
    expect(attachedModel.disposed).toBe(false)

    registry.openFile('b.py', 'Bの内容')
    expect(attachedModel.disposed).toBe(true)
  })

  it('エディタ上の編集内容がストアと一致していればモデルは再利用される', () => {
    const { host, created, current } = createFakeHost()
    const registry = createModelRegistry(host)

    registry.openFile('a.py', 'Aの内容')
    const modelA = created[0]
    modelA.setValue('Aの内容(編集後)')
    registry.openFile('b.py', 'Bの内容')

    // ストア側にも編集内容が保存されているため一致し、undo履歴が保たれる
    registry.openFile('a.py', 'Aの内容(編集後)')

    expect(current()).toBe(modelA)
  })

  it('ビューステートは保存され、同じファイルを開き直したときに復元される', () => {
    const { host } = createFakeHost()
    const saveViewState = vi.fn(() => ({ scrollTop: 120 }))
    const restoreViewState = vi.fn()
    const registry = createModelRegistry({ ...host, saveViewState, restoreViewState })

    registry.openFile('a.py', 'Aの内容')
    registry.openFile('b.py', 'Bの内容')
    registry.openFile('a.py', 'Aの内容')

    expect(restoreViewState).toHaveBeenCalledWith({ scrollTop: 120 })
  })

  it('破棄済みパスのビューステートは保存し直されない', () => {
    const { host } = createFakeHost()
    const saveViewState = vi.fn(() => ({ scrollTop: 120 }))
    const restoreViewState = vi.fn()
    const registry = createModelRegistry({ ...host, saveViewState, restoreViewState })

    registry.openFile('a.py', 'Aの内容')
    // 表示中の a.py が削除され、次のファイルへ切り替わる導線
    registry.prune(['b.py'])
    registry.openFile('b.py', 'Bの内容')
    // 同名ファイルが再作成されても、削除済みファイルのビューステートは復元されない
    registry.openFile('a.py', '')

    expect(restoreViewState).not.toHaveBeenCalled()
  })

  it('作り直したモデルには古いビューステートを復元しない', () => {
    const { host } = createFakeHost()
    const saveViewState = vi.fn(() => ({ scrollTop: 120 }))
    const restoreViewState = vi.fn()
    const registry = createModelRegistry({ ...host, saveViewState, restoreViewState })

    registry.openFile('a.py', 'Aの内容')
    registry.openFile('b.py', 'Bの内容')
    registry.openFile('a.py', '外部から上書きされた内容')

    expect(restoreViewState).not.toHaveBeenCalled()
  })
})

describe('createFileOpener', () => {
  it('開く前にストアの現況でモデルを整理する', () => {
    const { host, created, current } = createFakeHost()
    const registry = createModelRegistry(host)
    let paths = ['a.py', 'b.py']
    const openFile = createFileOpener(registry, () => paths)

    openFile('a.py', '', 'reuse')
    const deleted = created[0]
    openFile('b.py', 'Bの内容', 'reuse')

    // a.py が削除された後、同名ファイルが新規作成された（内容は空文字で一致する）
    paths = ['b.py']
    openFile('b.py', 'Bの内容', 'reuse')
    paths = ['b.py', 'a.py']
    openFile('a.py', '', 'reuse')

    // 削除済みファイルのモデル（＝undo履歴）は再利用されない
    expect(deleted.disposed).toBe(true)
    expect(current()).not.toBe(deleted)
  })
})
