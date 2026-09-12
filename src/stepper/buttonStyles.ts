// #stepRunBtn の className。index.html の初期状態と1文字も違わず一致させること
// （layout/index.test.ts の完全一致テストと同じ規律。issue #51 の折り返し回帰ガード）。
export const STEP_RUN_STYLE = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-accent/40 bg-accent/15 text-accent text-[11px] font-medium transition-colors cursor-pointer hover:bg-accent/25 shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-default'
