import type { InstructorController } from './controller'
import type { MenuAction } from '../menu/ui'

const MENU_ITEM_ID = 'instructorModeMenuItem'

function menuLabel(isOn: boolean): string {
  return isOn ? '講師モードをOFFにする' : '講師モードをONにする'
}

// ハンバーガーメニュー項目は初期化時に1度だけDOMへ生成される（menu/ui.ts参照）ため、
// ON/OFF切替のたびのラベル更新は syncInstructorMenuItem() でDOM idを直接引いて行う
// （呼び出しは controller の onStateChange 側で行う）。
export function createInstructorMenuAction(controller: InstructorController): MenuAction {
  return {
    id: MENU_ITEM_ID,
    label: menuLabel(controller.isOn()),
    ariaPressed: controller.isOn(),
    onClick: () => controller.toggle(),
  }
}

export function syncInstructorMenuItem(isOn: boolean): void {
  const item = document.getElementById(MENU_ITEM_ID)
  if (!item) return
  item.textContent = menuLabel(isOn)
  item.setAttribute('aria-pressed', String(isOn))
}

// 「基準を記録」ボタンはOFF時は存在自体を隠す（誤操作防止）。ONの間だけ操作できる。
export function initInstructorBaselineButton(controller: InstructorController): { sync: () => void } {
  const btn = document.getElementById('instructorBaselineBtn') as HTMLButtonElement | null

  function sync(): void {
    if (!btn) return
    const isOn = controller.isOn()
    btn.classList.toggle('hidden', !isOn)
    btn.classList.toggle('flex', isOn)
  }

  btn?.addEventListener('click', () => controller.recordBaseline())
  sync()
  return { sync }
}
