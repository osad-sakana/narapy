import type { WorkspaceSvg } from 'blockly'
import type { IrNode, VariableJson } from './types'

// 変数名 → Blockly variable IDのマップ
type VarMap = Map<string, string>

let counter = 0
function newId(): string {
  return `var_${++counter}`
}

export function buildVariableRegistry(
  nodes: IrNode[],
  workspace: WorkspaceSvg
): { getOrCreate: (name: string) => string; toJson: () => VariableJson[] } {
  const map: VarMap = new Map()

  // ワークスペースの既存変数を読み込む
  for (const v of workspace.getAllVariables()) {
    map.set(v.getName(), v.getId())
  }

  function getOrCreate(name: string): string {
    if (!map.has(name)) {
      const id = newId()
      map.set(name, id)
    }
    return map.get(name)!
  }

  function toJson(): VariableJson[] {
    return Array.from(map.entries()).map(([name, id]) => ({
      name,
      id,
      type: '',
    }))
  }

  // ノードツリーを事前スキャンして変数を収集
  collectVars(nodes, getOrCreate)

  return { getOrCreate, toJson }
}

function collectVars(nodes: IrNode[], reg: (n: string) => string): void {
  for (const node of nodes) {
    collectVarsNode(node, reg)
  }
}

function collectVarsNode(node: IrNode, reg: (n: string) => string): void {
  switch (node.type) {
    case 'Assign':
      reg(node.var_name)
      collectVarsNode(node.value, reg)
      break
    case 'VarRef':
      reg(node.name)
      break
    case 'ForRange':
      reg(node.var_name)
      collectVars(node.body, reg)
      break
    case 'ForEach':
      reg(node.var_name)
      collectVarsNode(node.iter, reg)
      collectVars(node.body, reg)
      break
    case 'If':
      collectVarsNode(node.condition, reg)
      collectVars(node.body, reg)
      for (const elif of node.elif_clauses) {
        collectVarsNode(elif.condition, reg)
        collectVars(elif.body, reg)
      }
      collectVars(node.else_body, reg)
      break
    case 'While':
      collectVarsNode(node.condition, reg)
      collectVars(node.body, reg)
      break
    case 'PrintStmt':
      collectVarsNode(node.value, reg)
      break
    case 'Return':
      if (node.value) collectVarsNode(node.value, reg)
      break
    case 'FuncDef':
      collectVars(node.body, reg)
      break
    case 'FuncCallStmt':
    case 'FuncCallExpr':
      for (const arg of node.args) collectVarsNode(arg, reg)
      break
    case 'BinOp':
    case 'Compare':
      collectVarsNode(node.left, reg)
      collectVarsNode(node.right, reg)
      break
    case 'BoolOp':
      collectVars(node.values, reg)
      break
    case 'Not':
      collectVarsNode(node.operand, reg)
      break
    case 'ListLit':
      collectVars(node.items, reg)
      break
    default:
      break
  }
}
