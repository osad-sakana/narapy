import { Blocks } from 'blockly'
import type { Block } from 'blockly'
import { pythonGenerator, Order } from 'blockly/python'

type FStringBlock = Block & {
  itemCount_: number
}

function rebuildInputs(block: FStringBlock, itemCount: number): void {
  for (let i = 0; i < block.itemCount_; i++) {
    block.removeInput(`ADD${i}`)
  }
  block.itemCount_ = 0
  for (let i = 0; i < itemCount; i++) {
    const inp = block.appendValueInput(`ADD${i}`)
    if (i === 0) inp.appendField('f"')
    block.itemCount_++
  }
  block.setInputsInline(true)
}

export function registerFStringBlock(): void {
  Blocks['text_fstring'] = {
    init(this: FStringBlock) {
      this.itemCount_ = 0
      this.setColour(160)
      this.setOutput(true, 'String')
      this.setTooltip('f文字列: 変数や式を埋め込んだ文字列')
    },

    saveExtraState(this: FStringBlock) {
      return { itemCount: this.itemCount_ }
    },

    loadExtraState(this: FStringBlock, state: Record<string, unknown>) {
      rebuildInputs(this, (state['itemCount'] as number | undefined) ?? 0)
    },
  }

  pythonGenerator.forBlock['text_fstring'] = (block, generator) => {
    const b = block as FStringBlock
    const itemCount = b.itemCount_ ?? 0
    const parts: string[] = []

    for (let i = 0; i < itemCount; i++) {
      const inner = block.getInputTargetBlock(`ADD${i}`)
      if (!inner) continue

      if (inner.type === 'text') {
        // リテラルテキスト: { と } をエスケープして埋め込む
        const literal = (inner.getFieldValue('TEXT') as string)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\{/g, '{{')
          .replace(/\}/g, '}}')
        parts.push(literal)
      } else {
        const code = generator.valueToCode(block, `ADD${i}`, Order.NONE) || ''
        parts.push(`{${code}}`)
      }
    }

    return [`f"${parts.join('')}"`, Order.ATOMIC]
  }
}
