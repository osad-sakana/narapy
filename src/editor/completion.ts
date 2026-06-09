import * as monaco from 'monaco-editor'

const KEYWORDS = [
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
  'while', 'with', 'yield',
]

const BUILTINS = [
  'abs', 'all', 'any', 'bin', 'bool', 'breakpoint', 'bytearray', 'bytes',
  'callable', 'chr', 'compile', 'complex', 'delattr', 'dict', 'dir',
  'divmod', 'enumerate', 'eval', 'exec', 'filter', 'float', 'format',
  'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
  'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list',
  'locals', 'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct',
  'open', 'ord', 'pow', 'print', 'property', 'range', 'repr', 'reversed',
  'round', 'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str',
  'sum', 'super', 'tuple', 'type', 'vars', 'zip',
]

const EXCEPTIONS = [
  'Exception', 'ValueError', 'TypeError', 'IndexError', 'KeyError',
  'AttributeError', 'ImportError', 'StopIteration', 'RuntimeError',
  'NotImplementedError', 'ZeroDivisionError', 'FileNotFoundError',
]

export function registerPythonCompletion(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const keywordItems: monaco.languages.CompletionItem[] = KEYWORDS.map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: kw,
        range,
      }))

      const builtinItems: monaco.languages.CompletionItem[] = BUILTINS.map((fn) => ({
        label: fn,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: fn,
        range,
      }))

      const exceptionItems: monaco.languages.CompletionItem[] = EXCEPTIONS.map((ex) => ({
        label: ex,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: ex,
        range,
      }))

      return { suggestions: [...keywordItems, ...builtinItems, ...exceptionItems] }
    },
  })
}
