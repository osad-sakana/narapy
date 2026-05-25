import type { utils } from 'blockly'

export const TOOLBOX_CONFIG: utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '入出力',
      colour: '#5BA58C',
      contents: [
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' },
      ],
    },
    {
      kind: 'category',
      name: '変数',
      colour: '#A55B80',
      custom: 'VARIABLE',
    },
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
    {
      kind: 'category',
      name: 'for ループ',
      colour: '#5BA55B',
      contents: [
        { kind: 'block', type: 'controls_for_range' },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: 'while ループ',
      colour: '#3D8A3D',
      contents: [
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: '条件分岐 (if)',
      colour: '#4A7FA5',
      contents: [
        { kind: 'block', type: 'controls_if' },
      ],
    },
    {
      kind: 'category',
      name: '関数 (def)',
      colour: '#995BA5',
      custom: 'PROCEDURE',
    },
  ],
}
