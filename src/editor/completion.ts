import * as monaco from 'monaco-editor'
import { describeCompletion } from './completionLabel'
import { describeOrigin } from './completionOrigin'
import type { CompletionWorkerOut } from './completionMeta'

type WorkerOut = CompletionWorkerOut

type PendingEntry = {
  resolve: (items: monaco.languages.CompletionItem[]) => void
  range: monaco.IRange
  timer: ReturnType<typeof setTimeout>
}

const KIND_MAP: Record<string, monaco.languages.CompletionItemKind> = {
  keyword:   monaco.languages.CompletionItemKind.Keyword,
  function:  monaco.languages.CompletionItemKind.Function,
  class:     monaco.languages.CompletionItemKind.Class,
  module:    monaco.languages.CompletionItemKind.Module,
  instance:  monaco.languages.CompletionItemKind.Variable,
  statement: monaco.languages.CompletionItemKind.Variable,
  param:     monaco.languages.CompletionItemKind.Field,
}

function toKind(type: string): monaco.languages.CompletionItemKind {
  return KIND_MAP[type] ?? monaco.languages.CompletionItemKind.Text
}

const STATIC_KEYWORDS = [
  'False','None','True','and','as','assert','async','await','break','class',
  'continue','def','del','elif','else','except','finally','for','from',
  'global','if','import','in','is','lambda','nonlocal','not','or','pass',
  'raise','return','try','while','with','yield',
]
const STATIC_BUILTINS = [
  'abs','all','any','bin','bool','breakpoint','bytearray','bytes','callable',
  'chr','compile','complex','delattr','dict','dir','divmod','enumerate','eval',
  'exec','filter','float','format','frozenset','getattr','globals','hasattr',
  'hash','help','hex','id','input','int','isinstance','issubclass','iter','len',
  'list','locals','map','max','memoryview','min','next','object','oct','open',
  'ord','pow','print','property','range','repr','reversed','round','set',
  'setattr','slice','sorted','staticmethod','str','sum','super','tuple','type',
  'vars','zip',
]
const STATIC_EXCEPTIONS = [
  'Exception','ValueError','TypeError','IndexError','KeyError','AttributeError',
  'ImportError','StopIteration','RuntimeError','NotImplementedError',
  'ZeroDivisionError','FileNotFoundError',
]

function staticItem(
  name: string,
  kind: monaco.languages.CompletionItemKind,
  description: string,
  range: monaco.IRange,
): monaco.languages.CompletionItem {
  return { label: { label: name, description }, kind, insertText: name, filterText: name, range }
}

function labelText(item: monaco.languages.CompletionItem): string {
  return typeof item.label === 'string' ? item.label : item.label.label
}

function buildStaticItems(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const { Keyword, Function, Class } = monaco.languages.CompletionItemKind
  return [
    ...STATIC_KEYWORDS.map((kw) => staticItem(kw, Keyword, 'キーワード', range)),
    ...STATIC_BUILTINS.map((fn) => staticItem(fn, Function, '組み込み関数', range)),
    ...STATIC_EXCEPTIONS.map((ex) => staticItem(ex, Class, '組み込みクラス', range)),
  ]
}

// コード長がこれを超えたらjedi解析をスキップ（DoS対策）
const CODE_MAX_CHARS = 200_000
// 未解決リクエストの上限（超えたら最古をフォールバック解決してリソース枯渇を防ぐ）
const PENDING_MAX = 5

let worker: Worker | null = null
let workerReady = false
let nextId = 0
const pending = new Map<number, PendingEntry>()

// pending エントリをタイマーごとキャンセルして静的候補で解決する
function evictEntry(id: number): void {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  clearTimeout(entry.timer)
  entry.resolve(buildStaticItems(entry.range))
}

// Worker クラッシュ時に全 pending を解決してワーカーを再生成可能な状態にする（HIGH-2）
function handleWorkerFailure(): void {
  for (const [id] of pending) evictEntry(id)
  worker?.terminate()
  worker = null
  workerReady = false
}

function getOrCreateWorker(): Worker {
  if (worker) return worker

  worker = new Worker(
    new URL('../completion.worker.ts', import.meta.url),
    { type: 'module' },
  )

  worker.onmessage = (event: MessageEvent<WorkerOut>) => {
    const msg = event.data
    if (msg.type === 'ready') {
      workerReady = true
      return
    }
    const entry = pending.get(msg.id)
    if (!entry) return
    clearTimeout(entry.timer)
    pending.delete(msg.id)

    if (msg.type === 'completions') {
      const jediItems = msg.items.map((item) => ({
        label: { label: item.name, description: describeCompletion(item) },
        kind: toKind(item.type),
        detail: describeOrigin(item) || undefined,
        insertText: item.name,
        filterText: item.name,
        range: entry.range,
      }))
      const jediNames = new Set(msg.items.map((i) => i.name))
      const extras = buildStaticItems(entry.range).filter(
        (item) => !jediNames.has(labelText(item)),
      )
      entry.resolve([...jediItems, ...extras])
    } else {
      entry.resolve(buildStaticItems(entry.range))
    }
  }

  worker.onerror = (event) => {
    console.error('completion worker error:', event.message)
    handleWorkerFailure()
  }

  worker.onmessageerror = () => {
    handleWorkerFailure()
  }

  return worker
}

export function registerPythonCompletion(): monaco.IDisposable {
  getOrCreateWorker()

  return monaco.languages.registerCompletionItemProvider('python', {
    async provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      if (!workerReady) {
        return { suggestions: buildStaticItems(range) }
      }

      const code = model.getValue()
      if (code.length > CODE_MAX_CHARS) {
        return { suggestions: buildStaticItems(range) }
      }

      const id = ++nextId
      const line = position.lineNumber   // jedi: 1-based
      const col = position.column - 1   // jedi: 0-based

      return new Promise<monaco.languages.CompletionList>((resolve) => {
        // 上限超えは最古エントリをタイマーごと破棄してから登録（MEDIUM-1）
        if (pending.size >= PENDING_MAX) {
          const [firstId] = pending.keys()
          evictEntry(firstId)
        }

        const timer = setTimeout(() => {
          pending.delete(id)
          resolve({ suggestions: buildStaticItems(range) })
        }, 2000)

        pending.set(id, {
          range,
          timer,
          resolve: (items) => {
            resolve({ suggestions: items })
          },
        })

        getOrCreateWorker().postMessage({ type: 'complete', id, code, line, col })
      })
    },
  })
}
