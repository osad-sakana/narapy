// #runBtn の className。runner/index.ts と node環境のテストの両方から
// 副作用のないモジュールとして参照できるよう、Monaco 等を読み込む index.ts から分離している。
const BTN_BASE = 'flex items-center gap-2 px-4 py-1.5 rounded-lg whitespace-nowrap shrink-0 text-sm font-bold transition-colors cursor-pointer border-2'

export const RUN_STYLE = `${BTN_BASE} bg-accent text-accent-ink border-accent hover:bg-accent-ink hover:text-accent`
export const STOP_STYLE = `${BTN_BASE} bg-danger text-white border-danger hover:bg-white hover:text-danger`
