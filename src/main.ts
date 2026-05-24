import {
  inject,
  Theme,
  Themes,
  Events,
  svgResize,
  Msg,
  type utils,
} from 'blockly'
import { pythonGenerator } from 'blockly/python'
import type { WorkspaceSvg } from 'blockly'

// --- 型定義 -----------------------------------------------------------

interface WorkerMessage {
  type: 'result' | 'error' | 'stdout'
  payload: string
}

// --- Blockly 初期化 ---------------------------------------------------

// ブロックのラベルを Python 構文に準拠させる
Object.assign(Msg, {
  // 真偽値
  LOGIC_BOOLEAN_TRUE:  'True',
  LOGIC_BOOLEAN_FALSE: 'False',
  // 比較・論理（and/or/not はデフォルトで一致）
  // input()
  TEXT_PROMPT_TYPE_TEXT:   'input(文字列) メッセージ:',
  TEXT_PROMPT_TYPE_NUMBER: 'input(数値) メッセージ:',
  // for ループ
  CONTROLS_REPEAT_TITLE:            'for _ in range(%1):',
  CONTROLS_REPEAT_INPUT_DO:         '',
  CONTROLS_FOR_TITLE:               'for %1 in range(%2, %3, %4):',
  CONTROLS_FOREACH_TITLE:           'for %1 in %2:',
  CONTROLS_FOREACH_INPUT_DO:        '',
  // while ループ
  CONTROLS_WHILEUNTIL_OPERATOR_WHILE: 'while',
  CONTROLS_WHILEUNTIL_OPERATOR_UNTIL: 'while not',
  CONTROLS_WHILEUNTIL_INPUT_DO:       '',
  // break / continue
  CONTROLS_FLOW_STATEMENTS_OPERATOR_BREAK:    'break',
  CONTROLS_FLOW_STATEMENTS_OPERATOR_CONTINUE: 'continue',
  // リスト
  LISTS_CREATE_WITH_INPUT_WITH: 'リスト:',
  LISTS_LENGTH_TITLE:           'len(%1)',
})

const TOOLBOX_CONFIG: utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    // 1. 入出力
    {
      kind: 'category',
      name: '入出力',
      colour: '#5BA58C',
      contents: [
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' },
      ],
    },
    // 2. 変数
    {
      kind: 'category',
      name: '変数',
      colour: '#A55B80',
      custom: 'VARIABLE',
    },
    // 3. 数値・演算
    {
      kind: 'category',
      name: '数値・演算',
      colour: '#5B67A5',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int' },
        { kind: 'block', type: 'math_number_property' },
      ],
    },
    // 4. 文字列
    {
      kind: 'category',
      name: 'str (文字列)',
      colour: '#5B8A6A',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_indexOf' },
        { kind: 'block', type: 'text_charAt' },
        { kind: 'block', type: 'text_getSubstring' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_trim' },
        { kind: 'block', type: 'text_replace' },
        { kind: 'block', type: 'text_count' },
        { kind: 'block', type: 'text_reverse' },
      ],
    },
    // 5. 比較・論理
    {
      kind: 'category',
      name: '比較・論理',
      colour: '#5C81A6',
      contents: [
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
      ],
    },
    // 6. リスト
    {
      kind: 'category',
      name: 'リスト',
      colour: '#A5745B',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_create_empty' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_indexOf' },
        { kind: 'block', type: 'lists_getSublist' },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_reverse' },
        { kind: 'block', type: 'lists_split' },
      ],
    },
    // 7. for ループ
    {
      kind: 'category',
      name: 'for ループ',
      colour: '#5BA55B',
      contents: [
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    // 8. while ループ
    {
      kind: 'category',
      name: 'while ループ',
      colour: '#3D8A3D',
      contents: [
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    // 9. 条件分岐
    {
      kind: 'category',
      name: '条件分岐 (if)',
      colour: '#4A7FA5',
      contents: [
        { kind: 'block', type: 'controls_if' },
      ],
    },
    // 10. 関数
    {
      kind: 'category',
      name: '関数 (def)',
      colour: '#995BA5',
      custom: 'PROCEDURE',
    },
    // 11. クラス（カスタムブロック未実装 — TODO）
    {
      kind: 'category',
      name: 'クラス (class)',
      colour: '#7A5BA5',
      contents: [],
    },
  ],
}

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

// ブロック���更時にエディタへ Python コードを反映
workspace.addChangeListener(() => {
  const code = pythonGenerator.workspaceToCode(workspace)
  codeEditor.value = code
  void triggerValidation(code)
})

// flyout 開閉後にレイアウトを再計算してスクロールバーをリセット
workspace.addChangeListener((event) => {
  if (event.type === Events.TOOLBOX_ITEM_SELECT) {
    requestAnimationFrame(() => svgResize(workspace))
  }
})

// --- DOM 参照 ---------------------------------------------------------

const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement
const outputLog = document.getElementById('outputLog') as HTMLDivElement
const validationBadge = document.getElementById('validationBadge') as HTMLSpanElement
const runBtn = document.getElementById('runBtn') as HTMLButtonElement
const clearLogBtn = document.getElementById('clearLogBtn') as HTMLButtonElement

// --- Rust Wasm バリデーション -----------------------------------------

// wasm-pack が出力する named export を直接参照する
type ParseFn = (source: string) => string
let wasmParseAndValidate: ParseFn | null = null

async function loadWasm(): Promise<void> {
  try {
    // wasm-pack --target web の出力: default が init 関数、named export が API
    const { default: init, parse_and_validate } =
      await import('./wasm/atmospya_core.js')
    await init()
    wasmParseAndValidate = parse_and_validate as ParseFn
  } catch {
    appendLog('[警告] Rust Wasm モジュールの読み込みに失敗しました。`pnpm build:wasm` を実行してください。', 'warn')
  }
}

async function triggerValidation(source: string): Promise<void> {
  if (!wasmParseAndValidate || source.trim() === '') {
    setBadge('待機中', 'neutral')
    return
  }
  try {
    const result = wasmParseAndValidate(source)
    const parsed = JSON.parse(result) as { status: string }
    if (parsed.status === 'success') {
      setBadge('構文OK', 'success')
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    setBadge(`エラー: ${message}`, 'error')
  }
}

function setBadge(text: string, state: 'neutral' | 'success' | 'error' | 'warn'): void {
  validationBadge.textContent = text
  validationBadge.className = [
    'text-xs px-2 py-0.5 rounded-full transition-all',
    state === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
    state === 'error'   ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
    state === 'warn'    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-slate-700 text-slate-400',
  ].join(' ')
}

// テキストエディタの手入力イベント
codeEditor.addEventListener('input', () => {
  void triggerValidation(codeEditor.value)
})

// --- Pyodide Web Worker 連携 -----------------------------------------

const pyodideWorker = new Worker(new URL('./pyodide.worker.ts', import.meta.url), { type: 'module' })

pyodideWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data
  if (type === 'stdout') {
    appendLog(payload, 'output')
  } else if (type === 'result') {
    appendLog(`=> ${payload}`, 'result')
    runBtn.disabled = false
    runBtn.textContent = '▶ 実行'
  } else if (type === 'error') {
    appendLog(`[エラー] ${payload}`, 'error')
    runBtn.disabled = false
    runBtn.textContent = '▶ 実行'
  }
}

pyodideWorker.onerror = (err: ErrorEvent) => {
  appendLog(`[Worker エラー] ${err.message}`, 'error')
  runBtn.disabled = false
  runBtn.textContent = '▶ 実行'
}

// 実行ボタン
runBtn.addEventListener('click', () => {
  const code = codeEditor.value.trim()
  if (!code) return

  runBtn.disabled = true
  runBtn.textContent = '⏳ 実行中…'
  appendLog('--- 実行開始 ---', 'info')

  pyodideWorker.postMessage({ type: 'run', code })
})

// ログクリア
clearLogBtn.addEventListener('click', () => {
  outputLog.innerHTML = '<span class="text-slate-600 italic">実行結果がここに表示されます…</span>'
})

// --- ログ出力ユーティリティ ------------------------------------------

function appendLog(text: string, kind: 'output' | 'result' | 'error' | 'info' | 'warn'): void {
  const line = document.createElement('div')
  line.textContent = text
  line.className = {
    output: 'text-slate-200',
    result: 'text-sky-300',
    error:  'text-red-400',
    info:   'text-slate-500',
    warn:   'text-amber-400',
  }[kind]

  const placeholder = outputLog.querySelector('span')
  if (placeholder) placeholder.remove()

  outputLog.appendChild(line)
  outputLog.scrollTop = outputLog.scrollHeight
}

// --- 初期化 ----------------------------------------------------------

void loadWasm()
