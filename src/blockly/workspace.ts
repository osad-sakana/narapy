import { inject, Theme, Themes, Events, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import type { WorkspaceSvg } from 'blockly'
import { TOOLBOX_CONFIG } from './toolbox'
import { initBlockTooltips } from './tooltips'

// Python→Blockly同期中はBlockly→Pythonのコールバックを抑制するフラグ
let syncingFromPython = false

export function setSyncingFromPython(value: boolean): void {
  syncingFromPython = value
}

export function isSyncingFromPython(): boolean {
  return syncingFromPython
}

// Blocklyのpython generatorが生成する「varname = None」宣言はPythonでは不要なので削除する。
// init()の後にdefinitions_.variablesをクリアすることで抑制する。
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
    // UIイベント（スクロール等）や、Python→Blockly同期中は無視
    if (event.isUiEvent || syncingFromPython) return
    onCodeChange(pythonGenerator.workspaceToCode(workspace))
  })

  // flyout 開閉後にレイアウトを再計算してスクロールバーをリセット
  workspace.addChangeListener((event) => {
    if (event.type === Events.TOOLBOX_ITEM_SELECT) {
      requestAnimationFrame(() => svgResize(workspace))
    }
  })

  const blocklyDiv = document.getElementById('blocklyDiv') as HTMLElement
  initBlockTooltips(blocklyDiv, workspace)

  return workspace
}
