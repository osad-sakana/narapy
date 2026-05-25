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
        inputs: {
          TO: { block: exprToBlock(node.to, getVarId) },
        },
      }
      if (bodyChain) block.inputs = { ...block.inputs, DO: { block: bodyChain } }
      return block
    }

    case 'ForEach': {
      const varId = getVarId(node.var_name)
      const bodyChain = stmtsToChain(node.body, getVarId)
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

    case 'BinOp':
      return {
        type: 'math_arithmetic',
        fields: { OP: node.op },
        inputs: {
          A: { block: exprToBlock(node.left, getVarId) },
          B: { block: exprToBlock(node.right, getVarId) },
        },
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

    case 'Unsupported':
      return { type: 'text', fields: { TEXT: node.code || `(${node.node_type})` } }

    default:
      return { type: 'text', fields: { TEXT: '' } }
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
