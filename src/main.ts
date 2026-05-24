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

// Python 構文はそのまま、英語の説明ラベルを日本語化
Object.assign(Msg, {
  // --- 真偽値 ---
  LOGIC_BOOLEAN_TRUE:  'True',
  LOGIC_BOOLEAN_FALSE: 'False',
  LOGIC_NULL:          'None',                // Python の None

  // --- 比較・論理（Python キーワードはそのまま） ---
  LOGIC_TERNARY_CONDITION: '条件',
  LOGIC_TERNARY_IF_TRUE:   'True の場合',
  LOGIC_TERNARY_IF_FALSE:  'False の場合',

  // --- 条件分岐 ---
  CONTROLS_IF_MSG_IF:              'if',       // Python キーワード
  CONTROLS_IF_MSG_ELSEIF:          'elif',     // Python キーワード（else if → elif）
  CONTROLS_IF_MSG_ELSE:            'else',     // Python キーワード
  CONTROLS_IF_MSG_THEN:            '',
  CONTROLS_IF_ELSEIF_TITLE_ELSEIF: 'elif',
  CONTROLS_IF_ELSE_TITLE_ELSE:     'else',
  CONTROLS_IF_IF_TITLE_IF:         'if',

  // --- for ループ ---
  CONTROLS_REPEAT_TITLE:     'for _ in range(%1):',
  CONTROLS_REPEAT_INPUT_DO:  '',
  CONTROLS_FOR_TITLE:        'for %1 in range(%2, %3, %4):',
  CONTROLS_FOR_INPUT_DO:     '',
  CONTROLS_FOREACH_TITLE:    'for %1 in %2:',
  CONTROLS_FOREACH_INPUT_DO: '',

  // --- while ループ ---
  CONTROLS_WHILEUNTIL_OPERATOR_WHILE: 'while',
  CONTROLS_WHILEUNTIL_OPERATOR_UNTIL: 'while not',
  CONTROLS_WHILEUNTIL_INPUT_DO:       '',

  // --- break / continue ---
  CONTROLS_FLOW_STATEMENTS_OPERATOR_BREAK:    'break',
  CONTROLS_FLOW_STATEMENTS_OPERATOR_CONTINUE: 'continue',

  // --- 数値・演算 ---
  MATH_MULTIPLICATION_SYMBOL:      '*',           // Python は *
  MATH_DIVISION_SYMBOL:            '/',           // Python は /
  MATH_POWER_SYMBOL:               '**',          // Python は **
  MATH_MODULO_TITLE:               '%1 % %2（余り）',
  MATH_IS_EVEN:                    'が偶数',
  MATH_IS_ODD:                     'が奇数',
  MATH_IS_PRIME:                   'が素数',
  MATH_IS_WHOLE:                   'が整数',
  MATH_IS_POSITIVE:                'が正の数',
  MATH_IS_NEGATIVE:                'が負の数',
  MATH_IS_DIVISIBLE_BY:            'で割り切れる',
  MATH_SINGLE_OP_ROOT:             '平方根 sqrt()',
  MATH_SINGLE_OP_ABSOLUTE:         '絶対値 abs()',
  MATH_ROUND_OPERATOR_ROUND:       '四捨五入 round()',
  MATH_ROUND_OPERATOR_ROUNDUP:     '切り上げ ceil()',
  MATH_ROUND_OPERATOR_ROUNDDOWN:   '切り捨て floor()',
  MATH_RANDOM_INT_TITLE:           '%1 〜 %2 のランダムな整数',
  MATH_RANDOM_FLOAT_TITLE_RANDOM:  'ランダムな小数（0〜1）',
  MATH_CHANGE_TITLE:               '%1 に %2 を加える',
  MATH_CHANGE_TITLE_ITEM:          '変数',

  // --- 文字列 ---
  TEXT_PRINT_TITLE:                       'print(%1)',   // Python 構文
  TEXT_PROMPT_TYPE_TEXT:                  'input() テキスト メッセージ:',
  TEXT_PROMPT_TYPE_NUMBER:                'input() 数値 メッセージ:',
  TEXT_APPEND_TITLE:                      '%1 に %2 を追加',
  TEXT_APPEND_VARIABLE:                   '変数',
  TEXT_LENGTH_TITLE:                      'len(%1)',     // Python 構文
  TEXT_ISEMPTY_TITLE:                     '%1 が空',
  TEXT_INDEXOF_TITLE:                     '%1 で %2 %3',
  TEXT_INDEXOF_OPERATOR_FIRST:            '最初の位置を検索 find()',
  TEXT_INDEXOF_OPERATOR_LAST:             '最後の位置を検索 rfind()',
  TEXT_CHARAT_TITLE:                      '%1 の %2',
  TEXT_CHARAT_FROM_START:                 '# 番目の文字',
  TEXT_CHARAT_FROM_END:                   '末尾から # 番目の文字',
  TEXT_CHARAT_FIRST:                      '先頭の文字',
  TEXT_CHARAT_LAST:                       '末尾の文字',
  TEXT_CHARAT_RANDOM:                     'ランダムな文字',
  TEXT_GET_SUBSTRING_INPUT_IN_TEXT:       '文字列',
  TEXT_GET_SUBSTRING_START_FIRST:         '先頭から部分文字列を取得',
  TEXT_GET_SUBSTRING_START_FROM_START:    '# 番目から部分文字列を取得',
  TEXT_GET_SUBSTRING_START_FROM_END:      '末尾から # 番目から部分文字列を取得',
  TEXT_GET_SUBSTRING_END_FROM_START:      '〜 # 番目まで',
  TEXT_GET_SUBSTRING_END_FROM_END:        '〜末尾から # 番目まで',
  TEXT_GET_SUBSTRING_END_LAST:            '〜末尾まで',
  TEXT_CHANGECASE_OPERATOR_UPPERCASE:     '大文字に upper()',
  TEXT_CHANGECASE_OPERATOR_LOWERCASE:     '小文字に lower()',
  TEXT_CHANGECASE_OPERATOR_TITLECASE:     'タイトル形式に title()',
  TEXT_TRIM_OPERATOR_BOTH:               '両端の空白を削除 strip()',
  TEXT_TRIM_OPERATOR_LEFT:               '左端の空白を削除 lstrip()',
  TEXT_TRIM_OPERATOR_RIGHT:              '右端の空白を削除 rstrip()',
  TEXT_COUNT_MESSAGE0:                   '%2 の中の %1 の個数 count()',
  TEXT_REPLACE_MESSAGE0:                 '%3 の %1 を %2 に置換 replace()',
  TEXT_REVERSE_MESSAGE0:                 '%1 を逆順に',
  TEXT_JOIN_TITLE_CREATEWITH:            '文字列を作成:',
  TEXT_CREATE_JOIN_TITLE_JOIN:           '結合',
  TEXT_CREATE_JOIN_ITEM_TITLE_ITEM:      '要素',

  // --- リスト ---
  LISTS_CREATE_WITH_INPUT_WITH:          'リスト:',
  LISTS_CREATE_WITH_CONTAINER_TITLE_ADD: 'リスト',
  LISTS_CREATE_WITH_ITEM_TITLE:          '要素',
  LISTS_CREATE_EMPTY_TITLE:              '空のリスト []',
  LISTS_LENGTH_TITLE:                    'len(%1)',     // Python 構文
  LISTS_ISEMPTY_TITLE:                   '%1 が空',
  LISTS_INLIST:                          'リスト',
  LISTS_GET_INDEX_INPUT_IN_LIST:         'リスト',
  LISTS_GET_INDEX_GET:                   '取得',
  LISTS_GET_INDEX_GET_REMOVE:            '取得して削除 pop()',
  LISTS_GET_INDEX_REMOVE:                '削除',
  LISTS_GET_INDEX_FROM_START:            '# 番目',
  LISTS_GET_INDEX_FROM_END:              '末尾から # 番目',
  LISTS_GET_INDEX_FIRST:                 '先頭',
  LISTS_GET_INDEX_LAST:                  '末尾',
  LISTS_GET_INDEX_RANDOM:                'ランダム',
  LISTS_SET_INDEX_INPUT_IN_LIST:         'リスト',
  LISTS_SET_INDEX_SET:                   'セット',
  LISTS_SET_INDEX_INSERT:                '挿入 insert()',
  LISTS_SET_INDEX_INPUT_TO:              'を',
  LISTS_INDEX_OF_INPUT_IN_LIST:          'リスト',
  LISTS_INDEX_OF_FIRST:                  '最初の位置を検索 index()',
  LISTS_INDEX_OF_LAST:                   '最後の位置を検索',
  LISTS_GET_SUBLIST_INPUT_IN_LIST:       'リスト',
  LISTS_GET_SUBLIST_START_FIRST:         '先頭からサブリストを取得',
  LISTS_GET_SUBLIST_START_FROM_START:    '# 番目からサブリストを取得',
  LISTS_GET_SUBLIST_START_FROM_END:      '末尾から # 番目からサブリストを取得',
  LISTS_GET_SUBLIST_END_FROM_START:      '〜 # 番目まで',
  LISTS_GET_SUBLIST_END_FROM_END:        '〜末尾から # 番目まで',
  LISTS_GET_SUBLIST_END_LAST:            '〜末尾まで',
  LISTS_SORT_TITLE:                      '%1 を %2 %3 でソート',
  LISTS_SORT_ORDER_ASCENDING:            '昇順',
  LISTS_SORT_ORDER_DESCENDING:           '降順',
  LISTS_SORT_TYPE_NUMERIC:               '数値',
  LISTS_SORT_TYPE_TEXT:                  '文字列',
  LISTS_SORT_TYPE_IGNORECASE:            '文字列（大小文字区別なし）',
  LISTS_SPLIT_LIST_FROM_TEXT:            '文字列をリストに分割 split()',
  LISTS_SPLIT_TEXT_FROM_LIST:            'リストを文字列に結合 join()',
  LISTS_SPLIT_WITH_DELIMITER:            '区切り文字:',
  LISTS_REVERSE_MESSAGE0:                '%1 を逆順に',
  LISTS_REPEAT_TITLE:                    '%1 を %2 回繰り返したリスト',

  // --- 関数 (def) ---
  PROCEDURES_DEFNORETURN_TITLE:     'def',         // Python キーワード
  PROCEDURES_DEFRETURN_TITLE:       'def',         // Python キーワード
  PROCEDURES_DEFNORETURN_PROCEDURE: '関数名',
  PROCEDURES_DEFRETURN_PROCEDURE:   '関数名',
  PROCEDURES_DEFRETURN_RETURN:      'return',      // Python キーワード
  PROCEDURES_DEFNORETURN_COMMENT:   '関数の説明...',
  PROCEDURES_DEFRETURN_COMMENT:     '関数の説明...',
  PROCEDURES_MUTATORCONTAINER_TITLE: '引数',
  PROCEDURES_MUTATORARG_TITLE:      '引数名:',
  PROCEDURES_BEFORE_PARAMS:         '引数:',
  PROCEDURES_CALL_BEFORE_PARAMS:    '引数:',
  PROCEDURES_CREATE_DO:             "'%1' を作成",
  PROCEDURES_ALLOW_STATEMENTS:      '処理を含める',
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
