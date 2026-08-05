// #runBtn の className。runner/index.ts と node環境のテストの両方から
// 副作用のないモジュールとして参照できるよう、Monaco 等を読み込む index.ts から分離している。
export const RUN_STYLE = 'flex items-center gap-2 px-4 py-1.5 rounded-lg whitespace-nowrap shrink-0 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-bold transition-colors shadow-md shadow-violet-900/50 cursor-pointer'
export const STOP_STYLE = 'flex items-center gap-2 px-4 py-1.5 rounded-lg whitespace-nowrap shrink-0 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-bold transition-colors shadow-md shadow-red-900/50 cursor-pointer'
