import { extractImportedModules } from './importScan'

export type ImportPreloader = {
  schedule: (code: string, cursorLine: number) => void
  dispose: () => void
}

type Options = {
  delayMs: number
  send: (code: string, cursorLine: number) => void
}

// コードの変更を受けて、入力が止まってから import の読み込みを Worker に頼む。
// import の一覧（入力中の行を除く）が前回と同じなら送らない（巨大なコードを何度も送らないため）
export function createImportPreloader({ delayMs, send }: Options): ImportPreloader {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastKey = ''

  return {
    schedule: (code, cursorLine) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const key = extractImportedModules(code, cursorLine).join(',')
        if (key === '' || key === lastKey) return
        lastKey = key
        send(code, cursorLine)
      }, delayMs)
    },
    dispose: () => clearTimeout(timer),
  }
}
