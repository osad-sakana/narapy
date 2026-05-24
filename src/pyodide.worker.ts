/// <reference lib="webworker" />

// Pyodide を CDN から動的ロードする（wasm ファイルを自前でホストする場合は indexURL を変更）
declare function importScripts(...urls: string[]): void

interface RunMessage {
  type: 'run'
  code: string
}

interface OutMessage {
  type: 'stdout' | 'result' | 'error'
  payload: string
}

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[]) => Promise<void>
  globals: {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
  }
}

declare const loadPyodide: (options: {
  indexURL: string
  stdout?: (text: string) => void
  stderr?: (text: string) => void
}) => Promise<PyodideInterface>

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/'

let pyodide: PyodideInterface | null = null
let isReady = false

// Pyodide を非同期で初期化（Worker 起動と同時に開始）
async function initPyodide(): Promise<void> {
  importScripts(`${PYODIDE_CDN}pyodide.js`)

  pyodide = await loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (text: string) => {
      const msg: OutMessage = { type: 'stdout', payload: text }
      self.postMessage(msg)
    },
    stderr: (text: string) => {
      const msg: OutMessage = { type: 'error', payload: text }
      self.postMessage(msg)
    },
  })

  isReady = true
}

const initPromise = initPyodide()

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  if (event.data.type !== 'run') return

  const { code } = event.data

  try {
    await initPromise

    if (!pyodide || !isReady) {
      const msg: OutMessage = { type: 'error', payload: 'Pyodide の初期化が完了していません' }
      self.postMessage(msg)
      return
    }

    const result = await pyodide.runPythonAsync(code)

    const msg: OutMessage = {
      type: 'result',
      payload: result === undefined || result === null ? '(None)' : String(result),
    }
    self.postMessage(msg)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const msg: OutMessage = { type: 'error', payload: message }
    self.postMessage(msg)
  }
}
