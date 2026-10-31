import * as monaco from 'monaco-editor'
import { queryWorker } from './completion'
import { hoverMarkdown, parseHoverInfo, parseSignatureHelp, signatureDocMarkdown, signatureLabel } from './intel'

function registerHover(): monaco.IDisposable {
  return monaco.languages.registerHoverProvider('python', {
    async provideHover(model, position, token) {
      const info = parseHoverInfo(await queryWorker('hover', model, position, token))
      if (!info) return null
      const word = model.getWordAtPosition(position)
      return {
        range: word
          ? new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
          : undefined,
        contents: [{ value: hoverMarkdown(info) }],
      }
    },
  })
}

function registerSignatureHelp(): monaco.IDisposable {
  return monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [')'],
    async provideSignatureHelp(model, position, token) {
      const help = parseSignatureHelp(await queryWorker('signature', model, position, token))
      if (!help) return null
      return {
        value: {
          signatures: help.signatures.map((info) => {
            const { label, parameters } = signatureLabel(info)
            const doc = signatureDocMarkdown(info.doc)
            return {
              label,
              parameters: parameters.map((range) => ({ label: range })),
              documentation: doc === undefined ? undefined : { value: doc },
              activeParameter: info.index,
            }
          }),
          activeSignature: help.active,
          activeParameter: help.signatures[help.active].index,
        },
        dispose: () => undefined,
      }
    },
  })
}

export function registerPythonIntel(): monaco.IDisposable {
  const disposables = [registerHover(), registerSignatureHelp()]
  return { dispose: () => disposables.forEach((d) => d.dispose()) }
}
