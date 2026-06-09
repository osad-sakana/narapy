import * as monaco from 'monaco-editor'

type WorkerOut =
  | { type: 'ready' }
  | { type: 'completions'; id: number; items: Array<{ name: string; type: string }> }
  | { type: 'complete_error'; id: number }

type PendingEntry = {
  resolve: (items: monaco.languages.CompletionItem[]) => void
  range: monaco.IRange
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

// jediが返す型文字列をMonacoのCompletionItemKindに変換
function toKind(type: string): monaco.languages.CompletionItemKind {
  return KIND_MAP[type] ?? monaco.languages.CompletionItemKind.Text
}

// jediが未初期化の間に表示する静的フォールバック
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

function buildStaticItems(range: monaco.IRange): monaco.languages.CompletionItem[] {
  return [
    ...STATIC_KEYWORDS.map((kw) => ({
      label: kw, kind: monaco.languages.CompletionItemKind.Keyword, insertText: kw, range,
    })),
    ...STATIC_BUILTINS.map((fn) => ({
      label: fn, kind: monaco.languages.CompletionItemKind.Function, insertText: fn, range,
    })),
    ...STATIC_EXCEPTIONS.map((ex) => ({
      label: ex, kind: monaco.languages.CompletionItemKind.Class, insertText: ex, range,
    })),
  ]
}

let worker: Worker | null = null
let workerReady = false
let nextId = 0
const pending = new Map<number, PendingEntry>()

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
    pending.delete(msg.id)

    if (msg.type === 'completions') {
      const items = msg.items.map((item) => ({
        label: item.name,
        kind: toKind(item.type),
        insertText: item.name,
        range: entry.range,
      }))
      entry.resolve(items)
    } else {
      entry.resolve(buildStaticItems(entry.range))
    }
  }

  return worker
}

export function registerPythonCompletion(): monaco.IDisposable {
  // ページロード時にWorkerの初期化を先行して開始する
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

      const id = ++nextId
      const code = model.getValue()
      const line = position.lineNumber        // jedi: 1-based
      const col = position.column - 1        // jedi: 0-based

      return new Promise<monaco.languages.CompletionList>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          resolve({ suggestions: buildStaticItems(range) })
        }, 2000)

        pending.set(id, {
          range,
          resolve: (items) => {
            clearTimeout(timer)
            resolve({ suggestions: items })
          },
        })

        getOrCreateWorker().postMessage({ type: 'complete', id, code, line, col })
      })
    },
  })
}
