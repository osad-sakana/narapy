// 選択中オブジェクトのコスチューム操作パネル。
// 画像の読み込み/削除と、軽い加工（左右反転・上下反転・白背景の透過）を提供する。

import type { GameObject, Costume } from './types'

export interface CostumePanelCallbacks {
  onLoad: (file: File) => void
  onRemove: () => void
  onToggle: (patch: Partial<Omit<Costume, 'src'>>) => void
}

const TOGGLE_BASE = 'px-2 py-1 rounded text-xs border transition-colors cursor-pointer'
const TOGGLE_ON = 'bg-sky-500/25 text-sky-100 border-sky-500/50'
const TOGGLE_OFF = 'text-slate-400 border-slate-700/60 hover:bg-slate-700/40'

function toggleButton(
  label: string,
  active: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.className = `${TOGGLE_BASE} ${active ? TOGGLE_ON : TOGGLE_OFF}`
  btn.addEventListener('click', onClick)
  return btn
}

function buildThumb(costume: Costume | undefined): HTMLElement {
  const box = document.createElement('div')
  box.className =
    'w-16 h-16 rounded-md border border-slate-700/60 bg-[#0c1622] flex items-center justify-center overflow-hidden shrink-0'
  if (costume) {
    const img = document.createElement('img')
    img.src = costume.src
    img.className = 'max-w-full max-h-full object-contain'
    img.style.transform = `scale(${costume.flipH ? -1 : 1}, ${costume.flipV ? -1 : 1})`
    box.appendChild(img)
  } else {
    const span = document.createElement('span')
    span.textContent = '矢印'
    span.className = 'text-[10px] text-slate-600'
    box.appendChild(span)
  }
  return box
}

function buildFileButton(label: string, onLoad: (file: File) => void): HTMLElement {
  const labelEl = document.createElement('label')
  labelEl.className =
    'block px-2 py-1 rounded text-xs text-violet-300 border border-dashed border-violet-700/60 hover:bg-violet-500/10 transition-colors cursor-pointer text-center'
  labelEl.textContent = label
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.className = 'hidden'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) onLoad(file)
    input.value = '' // 同じファイルの再選択を可能にする
  })
  labelEl.appendChild(input)
  return labelEl
}

// パネルを container へ再描画する。
export function renderCostumePanel(
  container: HTMLElement,
  active: GameObject | undefined,
  callbacks: CostumePanelCallbacks,
): void {
  container.replaceChildren()
  if (!active) return

  const costume = active.costume

  const row = document.createElement('div')
  row.className = 'flex gap-3'
  row.appendChild(buildThumb(costume))

  const controls = document.createElement('div')
  controls.className = 'flex flex-col gap-1.5 flex-1 min-w-0'
  controls.appendChild(
    buildFileButton(costume ? '画像を差し替え' : '画像を読み込む', callbacks.onLoad),
  )

  if (costume) {
    const toggles = document.createElement('div')
    toggles.className = 'flex flex-wrap gap-1'
    toggles.append(
      toggleButton('⇆ 左右', costume.flipH, () =>
        callbacks.onToggle({ flipH: !costume.flipH }),
      ),
      toggleButton('⇅ 上下', costume.flipV, () =>
        callbacks.onToggle({ flipV: !costume.flipV }),
      ),
      toggleButton('白を透過', costume.transparent, () =>
        callbacks.onToggle({ transparent: !costume.transparent }),
      ),
    )
    controls.appendChild(toggles)

    const remove = document.createElement('button')
    remove.textContent = '画像を外す'
    remove.className =
      'text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer text-left'
    remove.addEventListener('click', () => callbacks.onRemove())
    controls.appendChild(remove)
  }

  row.appendChild(controls)
  container.appendChild(row)
}
