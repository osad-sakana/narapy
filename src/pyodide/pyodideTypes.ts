// pyodide.worker.ts と traceRun.ts の両方から参照する Pyodide の型定義。
// completion.worker.ts は独自により狭いインターフェースを持つため、あちらは統合しない
// （補完 worker に不要な API 表面まで依存させないため）。
export interface PyFS {
  writeFile: (path: string, data: string | Uint8Array) => void
  mkdir: (path: string) => void
  analyzePath: (path: string) => { exists: boolean }
}

export interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string | string[]) => Promise<void>
  loadPackagesFromImports: (code: string) => Promise<void>
  setInterruptBuffer: (buffer: Uint8Array) => void
  globals: {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
  }
  FS: PyFS
}

export interface PyodideModule {
  loadPyodide: (options: {
    indexURL: string
    stdout?: (text: string) => void
    stderr?: (text: string) => void
  }) => Promise<PyodideInterface>
}
