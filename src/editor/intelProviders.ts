import * as monaco from 'monaco-editor'
import { queryWorker } from './completion'
import { describeSignature, hoverMarkdown, parseHoverInfo, parseSignatureHelp } from './intel'

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
            const view = describeSignature(info)
            return {
              label: view.label,
              parameters: view.parameters.map((p) => ({
                label: p.range,
                documentation: p.documentation,
              })),
              documentation: view.documentation === undefined ? undefined : { value: view.documentation },
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
