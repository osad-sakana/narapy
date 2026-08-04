// ファイルごとに独立したエディタモデルを保持し、ファイル切替でモデルごと差し替える(issue #47)。
// 全ファイルで単一モデルを共有すると、切替が「全文置換の編集操作」として undo スタックに
// 積まれ、Ctrl+Z で別ファイルの内容が現在のファイルへ書き戻されてしまうため。
// Monaco に直接依存させず host 経由で操作することで、単体テスト可能にしている。

export interface ManagedModel {
  getValue: () => string
  dispose: () => void
}

export interface ModelRegistryHost<M extends ManagedModel> {
  createModel: (content: string) => M
  setModel: (model: M) => void
  saveViewState?: () => unknown
  restoreViewState?: (state: unknown) => void
}

// reuse: 既存モデルを再利用してファイル別の undo 履歴を保つ（通常のファイル切替）
// fresh: 対象パスのモデルを作り直す（アップロード等でストアが外部から上書きされた場合）
// reset: 全モデルを破棄して作り直す（プロジェクト読込で全ファイルが入れ替わる場合）
export type OpenMode = 'reuse' | 'fresh' | 'reset'

export interface ModelRegistry {
  openFile: (path: string, content: string, mode?: OpenMode) => void
  prune: (existingPaths: readonly string[]) => void
  // 保持中のモデルを観測するための入口（テストと、将来 prune の契機を増やす際の確認用）
  getOpenPaths: () => readonly string[]
}

function omit<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [k, v] of Object.entries(record)) {
    if (k !== key) next[k] = v
  }
  return next
}

export function createModelRegistry<M extends ManagedModel>(
  host: ModelRegistryHost<M>,
): ModelRegistry {
  let models: Readonly<Record<string, M>> = {}
  let viewStates: Readonly<Record<string, unknown>> = {}
  let activePath = ''
  let attached: M | null = null
  // エディタに表示中のモデルを破棄するとエディタが壊れるため、差し替え後まで破棄を遅延する
  let pendingDispose: readonly M[] = []

  function release(stale: readonly M[]): void {
    const deferred = stale.filter(m => m === attached)
    for (const model of stale) {
      if (model !== attached) model.dispose()
    }
    pendingDispose = [...pendingDispose, ...deferred]
  }

  function attach(path: string, model: M): void {
    // 破棄済みパス（削除されたファイル）のビューステートは保存しない。
    // 保存すると prune で消したエントリが復活し、同名ファイルの再作成時に復元されてしまう。
    if (activePath && activePath !== path && models[activePath] && host.saveViewState) {
      viewStates = { ...viewStates, [activePath]: host.saveViewState() }
    }
    host.setModel(model)
    attached = model
    activePath = path

    const toDispose = pendingDispose
    pendingDispose = []
    for (const stale of toDispose) {
      if (stale !== model) stale.dispose()
    }

    const saved = viewStates[path]
    if (saved !== undefined && host.restoreViewState) host.restoreViewState(saved)
  }

  function openFile(path: string, content: string, mode: OpenMode = 'reuse'): void {
    if (mode === 'reset') {
      const all = Object.values(models)
      models = {}
      viewStates = {}
      release(all)
    }

    const existing = models[path]
    // reuse でも内容がストアとずれている場合は外部から上書きされた証拠なので作り直す。
    // 作り直さないと、上書き前の内容が undo で復元されてしまう(issue #47)。
    const canReuse = mode === 'reuse' && existing !== undefined && existing.getValue() === content

    if (canReuse) {
      attach(path, existing)
      return
    }

    if (existing !== undefined) {
      models = omit(models, path)
      viewStates = omit(viewStates, path)
      release([existing])
    }
    const model = host.createModel(content)
    models = { ...models, [path]: model }
    attach(path, model)
  }

  // ストアから消えたファイル（削除・プロジェクト読込）のモデルを破棄する。
  // 同名ファイルが再作成されたときに、削除済みファイルの undo 履歴が復活するのを防ぐ。
  function prune(existingPaths: readonly string[]): void {
    const keep = new Set(existingPaths)
    const stale = Object.entries(models).filter(([path]) => !keep.has(path))
    if (stale.length === 0) return
    let next: Readonly<Record<string, M>> = models
    let nextViewStates: Readonly<Record<string, unknown>> = viewStates
    for (const [path] of stale) {
      next = omit(next, path)
      nextViewStates = omit(nextViewStates, path)
    }
    models = next
    viewStates = nextViewStates
    release(stale.map(([, model]) => model))
  }

  return {
    openFile,
    prune,
    getOpenPaths: () => Object.keys(models),
  }
}

// ストアの現況に合わせてモデルを整理してからファイルを開く。
// main.ts の配線をテスト可能な形に切り出したもの。
export function createFileOpener(
  registry: ModelRegistry,
  listFilePaths: () => readonly string[],
): (path: string, content: string, mode: OpenMode) => void {
  return (path, content, mode) => {
    registry.prune(listFilePaths())
    registry.openFile(path, content, mode)
  }
}
