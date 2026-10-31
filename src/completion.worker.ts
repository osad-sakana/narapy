/// <reference lib="webworker" />

import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from './lib/pyodideLoader'
import completionHelperSource from './completion_helper.py?raw'
import { parseCompletionItems, type CompletionWorkerOut } from './editor/completionMeta'
import { memoizeRetryable } from './lib/memoizeRetryable'
import { AUTOPEP8_REQUIREMENTS, FORMAT_PY } from './format/formatModule'
import { RETRY_AFTER_MS, selectFreshModules } from './editor/importScan'

type RequestType = 'complete' | 'hover' | 'signature'
type QueryMessage = { type: RequestType; id: number; code: string; line: number; col: number }
type FormatMessage = { type: 'format'; id: number; code: string }
// import の先読み。応答は返さない（読み込みは背景で進む）
type PreloadMessage = { type: 'preload'; code: string; line: number }
type InMessage = QueryMessage | FormatMessage | PreloadMessage

// 呼び出す Python 関数名は固定の対応表から選ぶ（メッセージ由来の文字列を実行に使わない）
const PY_FUNCTIONS: Record<RequestType, string> = {
  complete: '_complete',
  hover: '_hover',
  signature: '_signature',
}

type OutMessage =
  | CompletionWorkerOut
  | { type: 'formatted'; id: number; result: unknown }
  | { type: 'format_error'; id: number }

interface LoadPackageOptions {
  messageCallback?: (msg: string) => void
  errorCallback?: (msg: string) => void
}

interface PyodideInterface {
  runPython: (code: string) => unknown
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[], options?: LoadPackageOptions) => Promise<void>
  loadPackagesFromImports: (code: string, options?: LoadPackageOptions) => Promise<void>
  globals: { set: (key: string, value: unknown) => void }
}

interface PyodideModule {
  loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>
}

let pyodide: PyodideInterface | null = null

// autopep8 は初回の整形時だけ導入する（補完の準備完了を PyPI 待ちにしないため）。
// 失敗・時間切れならメモを捨て、オフライン復帰後に再試行できるようにする。
const INSTALL_TIMEOUT_MS = 25_000

async function installFormatter(py: PyodideInterface): Promise<void> {
  await py.loadPackage('micropip', { messageCallback: () => undefined })
  py.globals.set('_reqs', AUTOPEP8_REQUIREMENTS)
  await py.runPythonAsync(`
import micropip as _mp
await _mp.install(list(_reqs))
`)
  py.runPython(FORMAT_PY)
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

let installing: Promise<void> | null = null
const ensureFormatterOnce = memoizeRetryable(async () => {
  // 時間切れ後もインストール自体は動き続けるため、実行中なら新しく始めず待つ
  const run = installing ?? (installing = installFormatter(pyodideOrThrow()).finally(() => { installing = null }))
  await withTimeout(run, INSTALL_TIMEOUT_MS)
})

function pyodideOrThrow(): PyodideInterface {
  if (!pyodide) throw new Error('pyodide not ready')
  return pyodide
}

async function init(): Promise<void> {
  const { loadPyodide } = await verifiedImport(
    `${PYODIDE_CDN}pyodide.mjs`,
    PYODIDE_MJS_HASH,
  ) as PyodideModule

  // 途中まで初期化されたインスタンスを公開しないよう、完了後にだけ代入する
  const py = await loadPyodide({ indexURL: PYODIDE_CDN })
  await py.loadPackage(['jedi'], { messageCallback: () => undefined })

  py.runPython(completionHelperSource)

  pyodide = py
  self.postMessage({ type: 'ready' } satisfies OutMessage)
}

// init 失敗後も次のリクエストで再試行できるよう、失敗したらメモを捨てる
const getInit = memoizeRetryable(init)

getInit().catch(() => undefined)

// 名前 → 次に読み込みを試してよい時刻。読み込み中・成功は Infinity、失敗は再試行できる時刻
const requestedModules = new Map<string, number>()
// 共有リンクなどで開いたコードが大きなパッケージを次々に読み込ませないよう、セッション全体の上限を置く
const MAX_SESSION_MODULES = 20

// import されたパッケージ（numpy・pygame など）を背景で読み込み、jedi が中身を見られるようにする。
// 補完の応答は待たせず、読み込み後の次の要求から反映される。名前は importScan で識別子に限っている
function loadImportedPackages(py: PyodideInterface, code: string, typingLine: number): void {
  const room = MAX_SESSION_MODULES - requestedModules.size
  if (room <= 0) return
  const fresh = selectFreshModules(code, typingLine, requestedModules, Date.now()).slice(0, room)
  if (fresh.length === 0) return
  fresh.forEach((name) => requestedModules.set(name, Infinity))

  // loadPackage は通信失敗でも reject せず errorCallback に流して resolve するため、そこで失敗を検知する
  let failed = false
  const source = fresh.map((name) => `import ${name}`).join('\n')
  py.loadPackagesFromImports(source, {
    messageCallback: () => undefined,
    errorCallback: () => { failed = true },
  })
    .then(() => {
      if (failed) throw new Error('package load failed')
      py.runPython('_refresh_modules()')
      // 初回の補完が解析待ちでタイムアウトしないよう、読み込み直後に解析しておく
      py.globals.set('_warm_names', fresh.join(','))
      py.runPython('_warm_modules(_warm_names)')
    })
    .catch(() => {
      const retryAt = Date.now() + RETRY_AFTER_MS
      fresh.forEach((name) => requestedModules.set(name, retryAt))
    })
}

function isValidId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id)
}

function isQueryMessage(msg: InMessage): msg is QueryMessage {
  // line / col は Format には無いので、未検証の入力として Partial 経由で調べる
  const q = msg as Partial<QueryMessage>
  return (
    Object.hasOwn(PY_FUNCTIONS, msg.type) &&
    isValidId(q.id) &&
    typeof q.code === 'string' &&
    typeof q.line === 'number' && Number.isInteger(q.line) && q.line >= 1 &&
    typeof q.col === 'number' && Number.isInteger(q.col) && q.col >= 0
  )
}

function isPreloadMessage(msg: InMessage): msg is PreloadMessage {
  const p = msg as Partial<PreloadMessage>
  return (
    msg.type === 'preload' &&
    typeof p.code === 'string' &&
    typeof p.line === 'number' && Number.isInteger(p.line) && p.line >= 1
  )
}

function isFormatMessage(msg: InMessage): msg is FormatMessage {
  return msg.type === 'format' && isValidId(msg.id) && typeof msg.code === 'string'
}

async function handleFormat({ id, code }: FormatMessage): Promise<void> {
  try {
    await getInit()
    if (!pyodide) throw new Error('pyodide not ready')
    await ensureFormatterOnce()
    pyodide.globals.set('_fmt_src', code)
    const raw = pyodide.runPython('_narapy_format(_fmt_src)')
    const result: unknown = typeof raw === 'string' ? JSON.parse(raw) : null
    self.postMessage({ type: 'formatted', id, result } satisfies OutMessage)
  } catch {
    self.postMessage({ type: 'format_error', id } satisfies OutMessage)
  }
}

function postFailure(type: RequestType, id: number): void {
  const out: OutMessage =
    type === 'complete' ? { type: 'complete_error', id } : { type: 'query_result', id, value: null }
  self.postMessage(out)
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data

  // ランタイムでメッセージ構造を検証することで型アサーション由来の不正入力を防ぐ
  if (!msg) return
  if (isFormatMessage(msg)) {
    await handleFormat(msg)
    return
  }
  if (isPreloadMessage(msg)) {
    try {
      await getInit()
      if (pyodide) loadImportedPackages(pyodide, msg.code, msg.line)
    } catch {
      // 初期化に失敗した場合は、次の補完要求の再試行に任せる
    }
    return
  }
  if (!isQueryMessage(msg)) return

  const { id, code, line, col } = msg

  try {
    await getInit()
    if (!pyodide) {
      postFailure(msg.type, id)
      return
    }
    loadImportedPackages(pyodide, code, line)
    // line/col もglobals経由で渡してテンプレート文字列への直接埋込みを廃止
    pyodide.globals.set('_src', code)
    pyodide.globals.set('_line', line)
    pyodide.globals.set('_col', col)
    const result = pyodide.runPython(`${PY_FUNCTIONS[msg.type]}(_src, _line, _col)`)

    // runPythonの戻り値をランタイム検証してから使う（L-3）
    const json = typeof result === 'string' ? result : 'null'
    const parsed: unknown = JSON.parse(json)

    if (msg.type === 'complete') {
      self.postMessage({ type: 'completions', id, items: parseCompletionItems(parsed) } satisfies OutMessage)
    } else {
      self.postMessage({ type: 'query_result', id, value: parsed } satisfies OutMessage)
    }
  } catch {
    postFailure(msg.type, id)
  }
}
