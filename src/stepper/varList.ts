import type { VarWithChange } from '../trace/varDiff'

const CHANGE_CLASS: Record<VarWithChange['change'], string> = {
  added: 'text-success',
  changed: 'text-warn',
  unchanged: 'text-ink',
}

function buildRow(v: VarWithChange): HTMLElement {
  const row = document.createElement('div')
  row.className = 'flex items-baseline gap-1.5 text-xs font-mono leading-relaxed'

  const name = document.createElement('span')
  name.className = `font-bold shrink-0 ${CHANGE_CLASS[v.change]}`
  name.textContent = v.name

  const type = document.createElement('span')
  type.className = 'text-muted shrink-0'
  type.textContent = v.type

  const value = document.createElement('span')
  value.className = 'text-ink break-all min-w-0'
  value.textContent = v.value

  row.append(name, type, value)
  return row
}

// 変数一覧をDOMに変換する。呼び出し側（ui.ts）が既存コンテナへ replaceChildren する。
export function buildVarList(vars: VarWithChange[]): HTMLElement {
  const list = document.createElement('div')
  list.className = 'flex flex-col gap-1'

  if (vars.length === 0) {
    const empty = document.createElement('span')
    empty.className = 'text-muted text-xs italic'
    empty.textContent = '変数はまだありません'
    list.appendChild(empty)
    return list
  }

  for (const v of vars) {
    list.appendChild(buildRow(v))
  }
  return list
}
