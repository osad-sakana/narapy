import { inject, Theme, Themes, Events, svgResize, Names, ShortcutRegistry } from 'blockly'
import { PALETTE } from '../theme/palette'
import { pythonGenerator, Order } from 'blockly/python'
import type { WorkspaceSvg } from 'blockly'
import { TOOLBOX_CONFIG } from './toolbox'
import { initBlockTooltips } from './tooltips'
import { registerUnsupportedBlock } from './unsupported'
import { registerForRangeBlock } from './forRange'
import { registerFStringBlock } from './fstring'
import { registerClassBlocks } from './classBlocks'

registerUnsupportedBlock()
registerForRangeBlock()
registerFStringBlock()
registerClassBlocks()

// Backspace / Delete キーによるブロック誤削除を防ぐ
ShortcutRegistry.registry.unregister('delete')

// Python→Blockly同期中はBlockly→Pythonのコールバックを抑制するフラグ
let syncingFromPython = false

export function setSyncingFromPython(value: boolean): void {
  syncingFromPython = value
}

export function isSyncingFromPython(): boolean {
  return syncingFromPython
}

// 未対応構文が存在する間はBlockly→Python同期を停止するフラグ
let hasUnsupportedCode = false

export function setHasUnsupportedCode(value: boolean): void {
  hasUnsupportedCode = value
}

export function isHasUnsupportedCode(): boolean {
  return hasUnsupportedCode
}

pythonGenerator.INDENT = '    '

// 文字列リテラルをシングルクォートではなくダブルクォートで出力する
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(pythonGenerator as any).quote_ = (str: string): string => {
  return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'
}

// text_prompt_ext の標準ジェネレーターは raw_input/input ヘルパーを出力してしまうため
// シンプルに input(msg) を返すよう上書きする
pythonGenerator.forBlock['text_prompt_ext'] = (block, generator) => {
  const msg = generator.valueToCode(block, 'TEXT', Order.NONE) || "''"
  return [`input(${msg})`, Order.FUNCTION_CALL]
}

// math_arithmetic に MODULO を追加対応する（標準ジェネレーターは MODULO を知らないため）
pythonGenerator.forBlock['math_arithmetic'] = (block, generator) => {
  const ops: Record<string, [string, number]> = {
    ADD:      [' + ',  Order.ADDITIVE],
    MINUS:    [' - ',  Order.ADDITIVE],
    MULTIPLY: [' * ',  Order.MULTIPLICATIVE],
    DIVIDE:   [' / ',  Order.MULTIPLICATIVE],
    POWER:    [' ** ', Order.EXPONENTIATION],
    MODULO:   [' % ',  Order.MULTIPLICATIVE],
  }
  const [symbol, order] = ops[block.getFieldValue('OP')] ?? [' + ', Order.ADDITIVE]
  const a = generator.valueToCode(block, 'A', order) || '0'
  const b = generator.valueToCode(block, 'B', order) || '0'
  return [`${a}${symbol}${b}`, order]
}

// lists_getIndex を Python 0ベースインデックスで動作させる（標準は1ベース変換あり）
pythonGenerator.forBlock['lists_getIndex'] = (block, generator) => {
  const mode  = block.getFieldValue('MODE')  || 'GET'
  const where = block.getFieldValue('WHERE') || 'FROM_START'
  const list  = generator.valueToCode(block, 'VALUE', Order.MEMBER) || '[]'

  switch (where) {
    case 'FIRST':
      if (mode === 'GET')        return [`${list}[0]`,       Order.MEMBER]
      if (mode === 'GET_REMOVE') return [`${list}.pop(0)`,   Order.FUNCTION_CALL]
      if (mode === 'REMOVE')     return `${list}.pop(0)\n`
      break
    case 'LAST':
      if (mode === 'GET')        return [`${list}[-1]`,      Order.MEMBER]
      if (mode === 'GET_REMOVE') return [`${list}.pop()`,    Order.FUNCTION_CALL]
      if (mode === 'REMOVE')     return `${list}.pop()\n`
      break
    case 'FROM_START': {
      const at = generator.valueToCode(block, 'AT', Order.MEMBER) || '0'
      if (mode === 'GET')        return [`${list}[${at}]`,       Order.MEMBER]
      if (mode === 'GET_REMOVE') return [`${list}.pop(${at})`,   Order.FUNCTION_CALL]
      if (mode === 'REMOVE')     return `${list}.pop(${at})\n`
      break
    }
    case 'FROM_END': {
      const at = generator.valueToCode(block, 'AT', Order.MEMBER) || '1'
      if (mode === 'GET')        return [`${list}[-${at}]`,      Order.MEMBER]
      if (mode === 'GET_REMOVE') return [`${list}.pop(-${at})`,  Order.FUNCTION_CALL]
      if (mode === 'REMOVE')     return `${list}.pop(-${at})\n`
      break
    }
  }
  throw new Error('Unhandled combination (lists_getIndex)')
}

// math_change を `varName += delta` 形式で生成する
pythonGenerator.forBlock['math_change'] = function (block) {
  const varName = pythonGenerator.nameDB_?.getName(
    block.getFieldValue('VAR'),
    Names.NameType.VARIABLE,
  ) ?? block.getFieldValue('VAR')
  const delta = pythonGenerator.valueToCode(block, 'DELTA', Order.ADDITIVE) || '0'
  return `${varName} += ${delta}\n`
}

// Blocklyのpython generatorが生成する「varname = None」宣言はPythonでは不要なので削除する。
const _origInit = pythonGenerator.init.bind(pythonGenerator)
pythonGenerator.init = function (ws: WorkspaceSvg) {
  _origInit(ws)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(this as any).definitions_['variables'] = ''
}


export function createWorkspace(onCodeChange: (code: string) => void): WorkspaceSvg {
  const workspace: WorkspaceSvg = inject('blocklyDiv', {
    // COEP 制約により外部 CDN をブロックされるためローカル配信パスを指定
    media: '/blockly-media/',
    toolbox: TOOLBOX_CONFIG,
    theme: Theme.defineTheme('narapy', {
      name: 'narapy',
      base: Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: PALETTE.editor,
        toolboxBackgroundColour: PALETTE.panel,
        toolboxForegroundColour: PALETTE.ink,
        flyoutBackgroundColour: PALETTE.panel,
        flyoutForegroundColour: PALETTE.ink,
        scrollbarColour: PALETTE.line,
        insertionMarkerColour: PALETTE.accent,
      },
    }),
    grid: {
      spacing: 20,
      length: 3,
      colour: PALETTE.line,
      snap: true,
    },
    sounds: false,
    zoom: {
      controls: false,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2,
    },
    trashcan: false,
    scrollbars: true,
  })

  workspace.addChangeListener((event) => {
    // UIイベント・Python→Blockly同期中・未対応構文あり の場合は無視
    if (event.isUiEvent || syncingFromPython || hasUnsupportedCode) return
    onCodeChange(pythonGenerator.workspaceToCode(workspace))
  })

  // flyout 開閉後にレイアウトを再計算してスクロールバーをリセット
  workspace.addChangeListener((event) => {
    if (event.type === Events.TOOLBOX_ITEM_SELECT) {
      requestAnimationFrame(() => svgResize(workspace))
    }
  })

  // unsupported_code ブロックが生成されたら必ずロックを強制適用する
  // （JSON シリアライザが movable/deletable を読まないため init() だけでは不十分な場合の保険）
  workspace.addChangeListener((event) => {
    if (event.type !== Events.BLOCK_CREATE) return
    const blockId = (event as unknown as { blockId?: string }).blockId
    if (!blockId) return
    const block = workspace.getBlockById(blockId)
    if (block?.type === 'unsupported_code') {
      block.setMovable(false)
      block.setDeletable(false)
    }
  })

  const blocklyDiv = document.getElementById('blocklyDiv') as HTMLElement
  initBlockTooltips(blocklyDiv, workspace)

  return workspace
}
