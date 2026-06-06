import { Blocks, FieldTextInput } from 'blockly'
import type { Block } from 'blockly'
import { pythonGenerator, Order } from 'blockly/python'

const CLASS_COLOUR = 20

type InstanceCreateBlock = Block & {
  argCount_: number
}

function rebuildInstanceArgs(block: InstanceCreateBlock, argCount: number): void {
  for (let i = 0; i < block.argCount_; i++) {
    block.removeInput(`ARG${i}`, true)
  }
  block.argCount_ = 0
  for (let i = 0; i < argCount; i++) {
    block.appendValueInput(`ARG${i}`)
    block.argCount_++
  }
  block.setInputsInline(true)
}

export function registerClassBlocks(): void {
  Blocks['class_def'] = {
    init(this: Block) {
      this.appendDummyInput()
        .appendField('class')
        .appendField(new FieldTextInput('MyClass'), 'CLASS_NAME')
        .appendField('(継承:')
        .appendField(new FieldTextInput(''), 'BASE_CLASS')
        .appendField(')')
      this.appendStatementInput('METHODS')
        .appendField('メソッド:')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(CLASS_COLOUR)
      this.setTooltip('クラスを定義します')
    },
  }

  pythonGenerator.forBlock['class_def'] = (block, generator) => {
    const className = block.getFieldValue('CLASS_NAME') || 'MyClass'
    const baseClass = (block.getFieldValue('BASE_CLASS') as string).trim()
    const methods = generator.statementToCode(block, 'METHODS') || generator.INDENT + 'pass\n'
    const header = baseClass
      ? `class ${className}(${baseClass}):\n`
      : `class ${className}:\n`
    return header + methods
  }

  Blocks['class_constructor'] = {
    init(this: Block) {
      this.appendDummyInput()
        .appendField('def __init__(self, ')
        .appendField(new FieldTextInput(''), 'PARAMS')
        .appendField(')')
      this.appendStatementInput('BODY')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(CLASS_COLOUR)
      this.setTooltip('コンストラクタ（初期化メソッド）を定義します')
    },
  }

  pythonGenerator.forBlock['class_constructor'] = (block, generator) => {
    const params = (block.getFieldValue('PARAMS') as string).trim()
    const signature = params ? `self, ${params}` : 'self'
    const body = generator.statementToCode(block, 'BODY') || generator.INDENT + 'pass\n'
    return `def __init__(${signature}):\n${body}`
  }

  Blocks['class_method'] = {
    init(this: Block) {
      this.appendDummyInput()
        .appendField('def')
        .appendField(new FieldTextInput('method'), 'METHOD_NAME')
        .appendField('(self, ')
        .appendField(new FieldTextInput(''), 'PARAMS')
        .appendField(')')
      this.appendStatementInput('BODY')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(CLASS_COLOUR)
      this.setTooltip('インスタンスメソッドを定義します')
    },
  }

  pythonGenerator.forBlock['class_method'] = (block, generator) => {
    const methodName = block.getFieldValue('METHOD_NAME') || 'method'
    const params = (block.getFieldValue('PARAMS') as string).trim()
    const signature = params ? `self, ${params}` : 'self'
    const body = generator.statementToCode(block, 'BODY') || generator.INDENT + 'pass\n'
    return `def ${methodName}(${signature}):\n${body}`
  }

  Blocks['class_self_attr_set'] = {
    init(this: Block) {
      this.appendValueInput('VALUE')
        .appendField('self.')
        .appendField(new FieldTextInput('attribute'), 'ATTR')
        .appendField('=')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(CLASS_COLOUR)
      this.setTooltip('self.属性に値を代入します')
    },
  }

  pythonGenerator.forBlock['class_self_attr_set'] = (block, generator) => {
    const attr = block.getFieldValue('ATTR') || 'attribute'
    const value = generator.valueToCode(block, 'VALUE', Order.NONE) || 'None'
    return `self.${attr} = ${value}\n`
  }

  Blocks['class_self_attr_get'] = {
    init(this: Block) {
      this.appendDummyInput()
        .appendField('self.')
        .appendField(new FieldTextInput('attribute'), 'ATTR')
      this.setOutput(true, null)
      this.setColour(CLASS_COLOUR)
      this.setTooltip('self.属性の値を取得します')
    },
  }

  pythonGenerator.forBlock['class_self_attr_get'] = (block) => {
    const attr = block.getFieldValue('ATTR') || 'attribute'
    return [`self.${attr}`, Order.MEMBER]
  }

  Blocks['class_instance_create'] = {
    init(this: InstanceCreateBlock) {
      this.argCount_ = 0
      this.appendDummyInput()
        .appendField(new FieldTextInput('MyClass'), 'CLASS_NAME')
        .appendField('()')
      this.setOutput(true, null)
      this.setInputsInline(true)
      this.setColour(CLASS_COLOUR)
      this.setTooltip('クラスのインスタンスを生成します。引数はPythonエディタで追加できます。')
    },

    saveExtraState(this: InstanceCreateBlock) {
      return { argCount: this.argCount_ }
    },

    loadExtraState(this: InstanceCreateBlock, state: Record<string, unknown>) {
      rebuildInstanceArgs(this, (state['argCount'] as number | undefined) ?? 0)
    },
  }

  pythonGenerator.forBlock['class_instance_create'] = (block, generator) => {
    const b = block as InstanceCreateBlock
    const className = block.getFieldValue('CLASS_NAME') || 'MyClass'
    const args: string[] = []
    for (let i = 0; i < b.argCount_; i++) {
      const arg = generator.valueToCode(block, `ARG${i}`, Order.NONE) || 'None'
      args.push(arg)
    }
    return [`${className}(${args.join(', ')})`, Order.FUNCTION_CALL]
  }
}
