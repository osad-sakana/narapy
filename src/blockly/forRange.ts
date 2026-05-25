import { Blocks, FieldVariable, Names } from 'blockly'
import type { Block } from 'blockly'
import { pythonGenerator } from 'blockly/python'

export function registerForRangeBlock(): void {
  Blocks['controls_for_range'] = {
    init(this: Block) {
      this.appendValueInput('TO')
        .setCheck('Number')
        .appendField('for')
        .appendField(new FieldVariable('i'), 'VAR')
        .appendField('in range(')
      this.appendDummyInput()
        .appendField(')')
      this.appendStatementInput('DO')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(120)
      this.setTooltip('指定した回数だけ繰り返します')
    },
  }

  pythonGenerator.forBlock['controls_for_range'] = (block, generator) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loopVar = (generator as any).nameDB_.getName(
      block.getFieldValue('VAR'),
      Names.NameType.VARIABLE,
    )
    const to = generator.valueToCode(block, 'TO', 0) || '0'
    const branch = generator.statementToCode(block, 'DO') || generator.INDENT + 'pass\n'
    return `for ${loopVar} in range(${to}):\n${branch}`
  }
}
