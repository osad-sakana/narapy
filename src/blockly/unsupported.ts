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
