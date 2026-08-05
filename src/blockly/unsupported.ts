import { Blocks, FieldLabel } from 'blockly'
import type { Block } from 'blockly'
import { pythonGenerator, Order } from 'blockly/python'

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

  pythonGenerator.forBlock['unsupported_code'] = (block: Block): string => {
    return (block.getFieldValue('CODE') as string) + '\n'
  }

  // 式コンテキスト用の未対応ブロック: output=null（任意スロットに接続可能）
  // Number・String どちらのスロットに置いても型不一致エラーが起きないようにする
  Blocks['unsupported_value'] = {
    init(this: Block) {
      this.appendDummyInput()
        .appendField('⚠ ')
        .appendField(new FieldLabel(''), 'CODE')
      this.setOutput(true, null)
      this.setColour(0)
      this.setMovable(false)
      this.setDeletable(false)
      this.setTooltip('この式はBlocklyでは表現できません。Pythonエディタで直接編集してください。')
    },
  }

  pythonGenerator.forBlock['unsupported_value'] = (block: Block): [string, number] => {
    return [block.getFieldValue('CODE') as string, Order.NONE]
  }
}

export function setBlocklyUnsupportedBanner(show: boolean): void {
  const banner = document.getElementById('blocklyUnsupportedBanner')
  const overlay = document.getElementById('blocklyOverlay')

  if (banner) {
    banner.className = show
      ? 'text-xs px-2 py-0.5 rounded-md bg-warn/15 text-warn border border-warn/30'
      : 'hidden'
  }

  // ワークスペース全体を覆うオーバーレイでブロック操作を禁止
  if (overlay) {
    overlay.className = show ? 'absolute inset-0 z-10 cursor-not-allowed' : 'hidden'
  }
}
