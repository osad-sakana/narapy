import { Blocks } from 'blockly'
import type { Block } from 'blockly'
import { pythonGenerator } from 'blockly/python'

export function registerRepeatBlock(): void {
  Blocks['controls_repeat'] = {
    init(this: Block) {
      this.appendValueInput('TIMES')
        .setCheck('Number')
        .appendField('repeat')
      this.appendDummyInput()
        .appendField('times')
      this.appendStatementInput('DO')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(120)
      this.setTooltip('指定した回数だけ繰り返します（ループ変数不要）')
    },
  }

  pythonGenerator.forBlock['controls_repeat'] = (block, generator) => {
    const times = generator.valueToCode(block, 'TIMES', 0) || '0'
    const branch = generator.statementToCode(block, 'DO') || generator.INDENT + 'pass\n'
    return `for _ in range(${times}):\n${branch}`
  }
}
