// Rust側 IrNode と1:1対応するdiscriminated union

export type IrNode =
  | { type: 'Program'; body: IrNode[] }
  | { type: 'PrintStmt'; value: IrNode }
  | { type: 'Assign'; var_name: string; value: IrNode }
  | { type: 'AugAssign'; var_name: string; op: string; value: IrNode }
  | { type: 'Return'; value: IrNode | null }
  | { type: 'Break' }
  | { type: 'Continue' }
  | { type: 'If'; condition: IrNode; body: IrNode[]; elif_clauses: ElifClause[]; else_body: IrNode[] }
  | { type: 'ForRange'; var_name: string; from: IrNode; to: IrNode; step: IrNode; body: IrNode[] }
  | { type: 'ForEach'; var_name: string; iter: IrNode; body: IrNode[] }
  | { type: 'While'; until: boolean; condition: IrNode; body: IrNode[] }
  | { type: 'FuncDef'; name: string; params: string[]; body: IrNode[]; has_return: boolean }
  | { type: 'FuncCallStmt'; name: string; args: IrNode[] }
  | { type: 'VarRef'; name: string }
  | { type: 'NumLit'; value: number }
  | { type: 'StrLit'; value: string }
  | { type: 'BoolLit'; value: boolean }
  | { type: 'ListLit'; items: IrNode[] }
  | { type: 'BinOp'; op: string; left: IrNode; right: IrNode }
  | { type: 'Compare'; op: string; left: IrNode; right: IrNode }
  | { type: 'BoolOp'; op: string; values: IrNode[] }
  | { type: 'Not'; operand: IrNode }
  | { type: 'FuncCallExpr'; name: string; args: IrNode[] }
  | { type: 'FStringLit'; parts: IrNode[] }
  | { type: 'Subscript'; value: IrNode; index: IrNode }
  | { type: 'Unsupported'; node_type: string; code: string }

export interface ElifClause {
  condition: IrNode
  body: IrNode[]
}

// Blockly serialization JSON の型
export interface BlocklyWorkspaceJson {
  blocks: {
    languageVersion: number
    blocks: BlockJson[]
  }
  variables?: VariableJson[]
}

export interface BlockJson {
  type: string
  id?: string
  fields?: Record<string, FieldValue>
  inputs?: Record<string, InputJson>
  next?: { block: BlockJson }
  mutation?: Record<string, string>
  extraState?: Record<string, unknown>
}

export type FieldValue = string | number | boolean | { id: string; name?: string }

export interface InputJson {
  block?: BlockJson
  shadow?: BlockJson
}

export interface VariableJson {
  name: string
  id: string
  type: string
}
