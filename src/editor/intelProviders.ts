import * as monaco from 'monaco-editor'
import { queryWorker } from './completion'
import { hoverMarkdown, parseHoverInfo, parseSignatureInfo, signatureLabel } from './intel'

function registerHover(): monaco.IDisposable {
  return monaco.languages.registerHoverProvider('python', {
    async provideHover(model, position) {
      const info = parseHoverInfo(await queryWorker('hover', model, position))
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
    async provideSignatureHelp(model, position) {
      const info = parseSignatureInfo(await queryWorker('signature', model, position))
      if (!info) return null
      const { label, parameters } = signatureLabel(info)
      return {
        value: {
          signatures: [{
            label,
            parameters: parameters.map((range) => ({ label: range })),
            documentation: info.doc === '' ? undefined : { value: `\`\`\`text\n${info.doc.replace(/```/g, "'''")}\n\`\`\`` },
          }],
          activeSignature: 0,
          activeParameter: info.index,
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
