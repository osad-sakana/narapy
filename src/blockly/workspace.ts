import { inject, Theme, Themes, Events, svgResize, Names } from 'blockly'
import { pythonGenerator, Order } from 'blockly/python'
import type { WorkspaceSvg } from 'blockly'
import { TOOLBOX_CONFIG } from './toolbox'
import { initBlockTooltips } from './tooltips'
import { registerUnsupportedBlock } from './unsupported'
import { registerForRangeBlock } from './forRange'
import { registerFStringBlock } from './fstring'

registerUnsupportedBlock()
registerForRangeBlock()
registerFStringBlock()

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
    theme: Theme.defineTheme('atmospya', {
      name: 'atmospya',
      base: Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#060d16',
        toolboxBackgroundColour: '#0c1e30',
        flyoutBackgroundColour: '#0c1e30',
      },
    }),
    grid: {
      spacing: 20,
      length: 3,
      colour: '#1e293b',
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
