import type { IrNode, BlockJson, BlocklyWorkspaceJson, InputJson } from './types'

type VarFn = (name: string) => string

// エントリポイント: IrNode.Program → BlocklyWorkspaceJson
export function irToWorkspaceJson(
  root: IrNode,
  getVarId: VarFn,
  variables: { name: string; id: string; type: string }[]
): BlocklyWorkspaceJson {
  if (root.type !== 'Program') {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  const topBlocks = stmtsToTopBlocks(root.body, getVarId)

  return {
    blocks: { languageVersion: 0, blocks: topBlocks },
    variables,
  }
}

// 文リスト → トップレベルブロック配列（nextチェーンに変換）
function stmtsToTopBlocks(nodes: IrNode[], getVarId: VarFn): BlockJson[] {
  const first = stmtsToChain(nodes, getVarId)
  return first ? [first] : []
}

// 文リスト → 先頭ブロック（後続はnextチェーンで繋ぐ）
function stmtsToChain(nodes: IrNode[], getVarId: VarFn): BlockJson | undefined {
  const blocks: BlockJson[] = []
  for (const node of nodes) {
    const b = stmtToBlock(node, getVarId)
    if (b) blocks.push(b)
  }
  if (blocks.length === 0) return undefined
  for (let i = blocks.length - 2; i >= 0; i--) {
    blocks[i].next = { block: blocks[i + 1] }
  }
  return blocks[0]
}

// 文ノード → BlockJson（文として繋げられるブロック）
function stmtToBlock(node: IrNode, getVarId: VarFn): BlockJson | undefined {
  switch (node.type) {
    case 'PrintStmt':
      return {
        type: 'text_print',
        inputs: { TEXT: { block: exprToBlock(node.value, getVarId) } },
      }

    case 'Assign': {
      const varId = getVarId(node.var_name)
      return {
        type: 'variables_set',
        fields: { VAR: { id: varId } },
        inputs: { VALUE: { block: exprToBlock(node.value, getVarId) } },
      }
    }

    case 'AugAssign': {
      const varId = getVarId(node.var_name)
      return {
        type: 'math_change',
        fields: { VAR: { id: varId } },
        inputs: { DELTA: { block: exprToBlock(node.value, getVarId) } },
      }
    }

    case 'Return':
      if (!node.value) return undefined
      return {
        type: 'procedures_ifreturn',
        inputs: {
          CONDITION: { block: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } },
          VALUE: { block: exprToBlock(node.value, getVarId) },
        },
      }

    case 'Break':
      return { type: 'controls_flow_statements', fields: { FLOW: 'BREAK' } }

    case 'Continue':
      return { type: 'controls_flow_statements', fields: { FLOW: 'CONTINUE' } }

    case 'If':
      return buildIfBlock(node, getVarId)

    case 'ForRange': {
      const varId = getVarId(node.var_name)
      const bodyChain = stmtsToChain(node.body, getVarId)
      const block: BlockJson = {
        type: 'controls_for_range',
        fields: { VAR: { id: varId } },
        inputs: { TO: { block: exprToBlock(node.to, getVarId) } },
      }
      if (bodyChain) block.inputs = { ...block.inputs, DO: { block: bodyChain } }
      return block
    }

    case 'ForEach': {
      const varId = getVarId(node.var_name)
      const bodyChain = stmtsToChain(node.body, getVarId)
      // String 型ブロックは controls_forEach の LIST スロット（Array 期待）に繋げられない
      if (producesStringBlock(node.iter)) {
        return {
          type: 'unsupported_code',
          fields: { CODE: `for ${node.var_name} in ...: ...` },
        }
      }
      const block: BlockJson = {
        type: 'controls_forEach',
        fields: { VAR: { id: varId } },
        inputs: { LIST: { block: exprToBlock(node.iter, getVarId) } },
      }
      if (bodyChain) block.inputs = { ...block.inputs, DO: { block: bodyChain } }
      return block
    }

    case 'While': {
      const bodyChain = stmtsToChain(node.body, getVarId)
      const block: BlockJson = {
        type: 'controls_whileUntil',
        fields: { MODE: node.until ? 'UNTIL' : 'WHILE' },
        inputs: { BOOL: { block: exprToBlock(node.condition, getVarId) } },
      }
      if (bodyChain) block.inputs = { ...block.inputs, DO: { block: bodyChain } }
      return block
    }

    case 'FuncDef': {
      const blockType = node.has_return ? 'procedures_defreturn' : 'procedures_defnoreturn'
      const params = node.params.map((p) => ({ name: p, id: getVarId(p) }))
      const bodyChain = stmtsToChain(node.body, getVarId)
      const block: BlockJson = {
        type: blockType,
        fields: { NAME: node.name },
        extraState: params.length > 0 ? { params } : {},
        inputs: bodyChain ? { STACK: { block: bodyChain } } : {},
      }
      return block
    }

    case 'FuncCallStmt': {
      const argInputs = buildArgInputs(node.args, getVarId)
      return {
        type: 'procedures_callnoreturn',
        extraState: {
          name: node.name,
          ...(node.args.length > 0 ? { params: node.args.map((_, i) => `arg${i}`) } : {}),
        },
        inputs: argInputs,
      }
    }

    case 'ClassDef': {
      const methodsChain = stmtsToChain(node.body, getVarId)
      const block: BlockJson = {
        type: 'class_def',
        fields: {
          CLASS_NAME: node.name,
          BASE_CLASS: node.base ?? '',
        },
      }
      if (methodsChain) block.inputs = { METHODS: { block: methodsChain } }
      return block
    }

    case 'InitDef': {
      const bodyChain = stmtsToChain(node.body, getVarId)
      const block: BlockJson = {
        type: 'class_constructor',
        fields: { PARAMS: node.params.join(', ') },
      }
      if (bodyChain) block.inputs = { BODY: { block: bodyChain } }
      return block
    }

    case 'MethodDef': {
      const bodyChain = stmtsToChain(node.body, getVarId)
      const block: BlockJson = {
        type: 'class_method',
        fields: {
          METHOD_NAME: node.name,
          PARAMS: node.params.join(', '),
        },
      }
      if (bodyChain) block.inputs = { BODY: { block: bodyChain } }
      return block
    }

    case 'SelfAttrAssign': {
      return {
        type: 'class_self_attr_set',
        fields: { ATTR: node.attr },
        inputs: { VALUE: { block: exprToBlock(node.value, getVarId) } },
      }
    }

    case 'Unsupported':
      return {
        type: 'unsupported_code',
        fields: { CODE: node.code },
      }

    // 式文（変数参照など）は無視
    default:
      return undefined
  }
}

function buildIfBlock(
  node: Extract<IrNode, { type: 'If' }>,
  getVarId: VarFn
): BlockJson {
  const elseIfCount = node.elif_clauses.length
  const hasElse = node.else_body.length > 0

  const extraState: Record<string, unknown> = {}
  if (elseIfCount > 0) extraState['elseIfCount'] = elseIfCount
  if (hasElse) extraState['hasElse'] = true

  const inputs: Record<string, InputJson> = {}

  // if の条件とbody
  inputs['IF0'] = { block: exprToBlock(node.condition, getVarId) }
  const bodyChain = stmtsToChain(node.body, getVarId)
  if (bodyChain) inputs['DO0'] = { block: bodyChain }

  // elif の条件とbody
  node.elif_clauses.forEach((elif, i) => {
    inputs[`IF${i + 1}`] = { block: exprToBlock(elif.condition, getVarId) }
    const elifChain = stmtsToChain(elif.body, getVarId)
    if (elifChain) inputs[`DO${i + 1}`] = { block: elifChain }
  })

  // else body
  if (hasElse) {
    const elseChain = stmtsToChain(node.else_body, getVarId)
    if (elseChain) inputs['ELSE'] = { block: elseChain }
  }

  return {
    type: 'controls_if',
    extraState: Object.keys(extraState).length > 0 ? extraState : undefined,
    inputs,
  }
}

// Array スロットに接続できない String 型ブロックを生成するノードか判定
function producesStringBlock(node: IrNode): boolean {
  if (node.type === 'StrLit' || node.type === 'FStringLit' || node.type === 'Unsupported') return true
  if (node.type === 'BinOp' && node.op === 'ADD') {
    return producesStringBlock(node.left) || producesStringBlock(node.right)
  }
  return false
}

// 左結合でネストした ADD 連鎖（"a" + "b" + "c" → BinOp(ADD, BinOp(ADD, a, b), c)）を
// 平坦なノード配列に正規化する
function flattenAddChain(node: IrNode): IrNode[] {
  if (node.type === 'BinOp' && node.op === 'ADD') {
    return [...flattenAddChain(node.left), ...flattenAddChain(node.right)]
  }
  return [node]
}

// 式ノード → BlockJson（value inputに入れるブロック）
function exprToBlock(node: IrNode, getVarId: VarFn): BlockJson {
  switch (node.type) {
    case 'NumLit':
      return { type: 'math_number', fields: { NUM: node.value } }

    case 'StrLit':
      return { type: 'text', fields: { TEXT: node.value } }

    case 'BoolLit':
      return { type: 'logic_boolean', fields: { BOOL: node.value ? 'TRUE' : 'FALSE' } }

    case 'VarRef': {
      const varId = getVarId(node.name)
      return { type: 'variables_get', fields: { VAR: { id: varId } } }
    }

    case 'ListLit': {
      const extraState = { itemCount: node.items.length }
      const inputs: Record<string, InputJson> = {}
      node.items.forEach((item, i) => {
        inputs[`ADD${i}`] = { block: exprToBlock(item, getVarId) }
      })
      return { type: 'lists_create_with', extraState, inputs }
    }

    case 'Subscript':
      // String 型ブロックは lists_getIndex の VALUE スロット（Array 期待）に繋げられない
      // → 文字列系は text_charAt、それ以外は Unsupported にフォールバック
      if (producesStringBlock(node.value)) {
        if (node.value.type === 'StrLit' || node.value.type === 'FStringLit') {
          return {
            type: 'text_charAt',
            fields: { WHERE: 'FROM_START' },
            inputs: {
              VALUE: { block: exprToBlock(node.value, getVarId) },
              AT: { block: exprToBlock(node.index, getVarId) },
            },
          }
        }
        return {
          type: 'unsupported_code',
          fields: { CODE: `...[${node.index.type === 'NumLit' ? node.index.value : '...'}]` },
        }
      }
      // インデックスが String 型ブロックを生成する場合（辞書・DataFrame等の文字列キーアクセス）:
      // lists_getIndex の AT スロットは Number 型必須なので接続できない → unsupported_value にフォールバック
      if (producesStringBlock(node.index)) {
        const varPart = node.value.type === 'VarRef' ? node.value.name : '...'
        const idxPart = node.index.type === 'StrLit' ? `"${node.index.value}"` : '...'
        return {
          type: 'unsupported_value',
          fields: { CODE: `${varPart}[${idxPart}]` },
        }
      }
      return {
        type: 'lists_getIndex',
        fields: { MODE: 'GET', WHERE: 'FROM_START' },
        inputs: {
          VALUE: { block: exprToBlock(node.value, getVarId) },
          AT: { block: exprToBlock(node.index, getVarId) },
        },
      }

    case 'BinOp': {
      // ADD の連鎖にひとつでも文字列系の項が含まれる場合、連鎖全体を平坦化して
      // 単一の N 項 text_join（文字列連結ブロック）にする。
      // ("name" + "age" + "は" のような左結合ネストを nested text_join にすると
      //  再生成された Python が壊れて実行できなくなるため、必ず平坦化する)
      if (node.op === 'ADD') {
        const addends = flattenAddChain(node)
        const isStringConcat = addends.some(
          (a) => a.type === 'StrLit' || a.type === 'FStringLit'
        )
        if (isStringConcat) {
          const inputs: Record<string, InputJson> = {}
          addends.forEach((addend, i) => {
            inputs[`ADD${i}`] = { block: exprToBlock(addend, getVarId) }
          })
          return {
            type: 'text_join',
            extraState: { itemCount: addends.length },
            inputs,
          }
        }
      }
      return {
        type: 'math_arithmetic',
        fields: { OP: node.op },
        inputs: {
          A: { block: exprToBlock(node.left, getVarId) },
          B: { block: exprToBlock(node.right, getVarId) },
        },
      }
    }

    case 'Compare':
      return {
        type: 'logic_compare',
        fields: { OP: node.op },
        inputs: {
          A: { block: exprToBlock(node.left, getVarId) },
          B: { block: exprToBlock(node.right, getVarId) },
        },
      }

    case 'BoolOp': {
      // BoolOpは2つ以上の値を持つが、Blocklyはペアなので最初の2つを使う
      const a = node.values[0] ?? { type: 'BoolLit' as const, value: true }
      const b = node.values[1] ?? { type: 'BoolLit' as const, value: true }
      return {
        type: 'logic_operation',
        fields: { OP: node.op },
        inputs: {
          A: { block: exprToBlock(a, getVarId) },
          B: { block: exprToBlock(b, getVarId) },
        },
      }
    }

    case 'Not':
      return {
        type: 'logic_negate',
        inputs: { BOOL: { block: exprToBlock(node.operand, getVarId) } },
      }

    case 'FuncCallExpr': {
      // input() は text_prompt_ext ブロックにマッピング
      if (node.name === 'input') {
        const promptBlock = node.args[0]
          ? exprToBlock(node.args[0], getVarId)
          : { type: 'text', fields: { TEXT: '' } }
        return {
          type: 'text_prompt_ext',
          fields: { TYPE: 'TEXT' },
          inputs: { TEXT: { block: promptBlock } },
        }
      }
      const argInputs = buildArgInputs(node.args, getVarId)
      return {
        type: 'procedures_callreturn',
        extraState: {
          name: node.name,
          ...(node.args.length > 0 ? { params: node.args.map((_, i) => `arg${i}`) } : {}),
        },
        inputs: argInputs,
      }
    }

    case 'FStringLit': {
      const inputs: Record<string, InputJson> = {}
      node.parts.forEach((part, i) => {
        inputs[`ADD${i}`] = { block: exprToBlock(part, getVarId) }
      })
      return {
        type: 'text_fstring',
        extraState: { itemCount: node.parts.length },
        inputs,
      }
    }

    case 'SelfAttrRef':
      return {
        type: 'class_self_attr_get',
        fields: { ATTR: node.attr },
      }

    case 'InstanceCreate': {
      const argInputs: Record<string, InputJson> = {}
      node.args.forEach((arg, i) => {
        argInputs[`ARG${i}`] = { block: exprToBlock(arg, getVarId) }
      })
      return {
        type: 'class_instance_create',
        fields: { CLASS_NAME: node.class_name },
        extraState: { argCount: node.args.length },
        inputs: argInputs,
      }
    }

    case 'Unsupported':
      return { type: 'unsupported_value', fields: { CODE: node.code || `(${node.node_type})` } }

    default:
      return { type: 'unsupported_value', fields: { CODE: '' } }
  }
}

function buildArgInputs(
  args: IrNode[],
  getVarId: VarFn
): Record<string, InputJson> {
  const inputs: Record<string, InputJson> = {}
  args.forEach((arg, i) => {
    inputs[`ARG${i}`] = { block: exprToBlock(arg, getVarId) }
  })
  return inputs
}
