import { Msg, defineBlocksWithJsonArray } from 'blockly'

export function applyBlocklyMessages(): void {
  // Python 構文はそのまま、英語の説明ラベルを日本語化
  Object.assign(Msg, {
    // カスタムツールチップで代替するため Blockly 組み込みを抑制
    TEXT_PRINT_TOOLTIP: '',

    // --- 真偽値 ---
    LOGIC_BOOLEAN_TRUE:  'True',
    LOGIC_BOOLEAN_FALSE: 'False',
    LOGIC_NULL:          'None',

    // --- 比較・論理 ---
    LOGIC_TERNARY_CONDITION: '条件',
    LOGIC_TERNARY_IF_TRUE:   'True の場合',
    LOGIC_TERNARY_IF_FALSE:  'False の場合',

    // --- 条件分岐 ---
    CONTROLS_IF_MSG_IF:              'if',
    CONTROLS_IF_MSG_ELSEIF:          'elif',
    CONTROLS_IF_MSG_ELSE:            'else',
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
    MATH_MULTIPLICATION_SYMBOL:      '*',
    MATH_DIVISION_SYMBOL:            '/',
    MATH_POWER_SYMBOL:               '**',
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
    MATH_CHANGE_TITLE:               '%1 += %2',
    MATH_CHANGE_TITLE_ITEM:          '変数',

    // --- 文字列 ---
    TEXT_PRINT_TITLE:                       'print(%1)',
    TEXT_PROMPT_TYPE_TEXT:                  'input() テキスト メッセージ:',
    TEXT_PROMPT_TYPE_NUMBER:                'input() 数値 メッセージ:',
    TEXT_APPEND_TITLE:                      '%1 に %2 を追加',
    TEXT_APPEND_VARIABLE:                   '変数',
    TEXT_LENGTH_TITLE:                      'len(%1)',
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
    LISTS_LENGTH_TITLE:                    'len(%1)',
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

    // --- 変数 ---
    VARIABLES_SET:          '%1 = %2',
    VARIABLES_DEFAULT_NAME: '変数',

    // --- 関数 (def) ---
    PROCEDURES_DEFNORETURN_TITLE:      'def',
    PROCEDURES_DEFRETURN_TITLE:        'def',
    PROCEDURES_DEFNORETURN_PROCEDURE:  'my_function',
    PROCEDURES_DEFRETURN_PROCEDURE:    'my_function',
    PROCEDURES_DEFRETURN_RETURN:       'return',
    PROCEDURES_DEFNORETURN_COMMENT:    '関数の説明...',
    PROCEDURES_DEFRETURN_COMMENT:      '関数の説明...',
    PROCEDURES_MUTATORCONTAINER_TITLE: '引数',
    PROCEDURES_MUTATORARG_TITLE:       '引数名:',
    PROCEDURES_BEFORE_PARAMS:          '引数:',
    PROCEDURES_CALL_BEFORE_PARAMS:     '引数:',
    PROCEDURES_CREATE_DO:              "'%1' を作成",
    PROCEDURES_ALLOW_STATEMENTS:       '処理を含める',
  })

  // math_arithmetic に % (MODULO) を追加し、演算子表記を Python 準拠に統一する
  defineBlocksWithJsonArray([
    {
      type: 'math_arithmetic',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'A', check: 'Number' },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['+',  'ADD'],
            ['-',  'MINUS'],
            ['*',  'MULTIPLY'],
            ['/',  'DIVIDE'],
            ['**', 'POWER'],
            ['%',  'MODULO'],
          ],
        },
        { type: 'input_value', name: 'B', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      style: 'math_blocks',
    },
  ])

  // logic_compare のドロップダウンを Python 演算子に差し替え（Blockly デフォルトは =/≠/≤/≥）
  defineBlocksWithJsonArray([{
    type: 'logic_compare',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A' },
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [['==','EQ'],['!=','NEQ'],['<','LT'],['<=','LTE'],['>','GT'],['>=','GTE']],
      },
      { type: 'input_value', name: 'B' },
    ],
    inputsInline: true,
    output: 'Boolean',
    style: 'logic_blocks',
    extensions: ['logic_compare', 'logic_op_tooltip'],
  }])
}
