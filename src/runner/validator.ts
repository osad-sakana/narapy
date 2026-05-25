import { appendLog } from './log'
import { setBadge } from './badge'

type ParseFn = (source: string) => string
type IrFn = (source: string) => string

let wasmParseAndValidate: ParseFn | null = null
let wasmPythonToIr: IrFn | null = null

export async function loadWasm(): Promise<void> {
  try {
    const { default: init, parse_and_validate, python_to_ir } =
      await import('../wasm/atmospya_core.js')
    await init()
    wasmParseAndValidate = parse_and_validate as ParseFn
    wasmPythonToIr = python_to_ir as IrFn
  } catch {
    appendLog('[警告] Rust Wasm モジュールの読み込みに失敗しました。`pnpm build:wasm` を実行してください。', 'warn')
  }
}

export async function triggerValidation(source: string): Promise<void> {
  if (!wasmParseAndValidate || source.trim() === '') {
    setBadge('待機中', 'neutral')
    return
  }
  try {
    const result = wasmParseAndValidate(source)
    const parsed = JSON.parse(result) as { status: string }
    if (parsed.status === 'success') {
      setBadge('構文OK', 'success')
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    setBadge(`エラー: ${message}`, 'error')
  }
}

export function getPythonToIr(): IrFn | null {
  return wasmPythonToIr
}
