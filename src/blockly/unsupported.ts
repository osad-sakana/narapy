import { Blocks, FieldLabel } from 'blockly'
import type { Block } from 'blockly'
import { pythonGenerator } from 'blockly/python'

export function registerUnsupportedBlock(): void {
  Blocks['unsupported_code'] = {
    init(this: Block) {
      this.appendDummyInput()
        .appendField('⚠ 未対応構文: ')
        .appendField(new FieldLabel(''), 'CODE')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(0)
      this.setMovable(false)
      this.setDeletable(false)
      this.setTooltip('この構文はBlocklyでは表現できません。Pythonエディタで直接編集してください。')
    },
  }

  // Python generator: ブロックに保持しているコードテキストをそのまま出力
  pythonGenerator.forBlock['unsupported_code'] = (block: Block): string => {
    return (block.getFieldValue('CODE') as string) + '\n'
  }
}

export function setBlocklyUnsupportedBanner(show: boolean): void {
  const banner = document.getElementById('blocklyUnsupportedBanner')
  const overlay = document.getElementById('blocklyOverlay')

  if (banner) {
    banner.className = show
      ? 'text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30'
      : 'hidden'
  }

  // ワークスペース全体を覆うオーバーレイでブロック操作を禁止
  if (overlay) {
    overlay.className = show ? 'absolute inset-0 z-10 cursor-not-allowed' : 'hidden'
  }
}
