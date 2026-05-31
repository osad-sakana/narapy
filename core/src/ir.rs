use serde::Serialize;

/// Blocklyの各ブロックに対応する中間表現。
/// TypeScript側でBlockly serialization JSONに変換される。
#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum IrNode {
    Program {
        body: Vec<IrNode>,
    },
    // --- 文 ---
    PrintStmt {
        value: Box<IrNode>,
    },
    Assign {
        var_name: String,
        value: Box<IrNode>,
    },
    AugAssign {
        var_name: String,
        op: String,
        value: Box<IrNode>,
    },
    Return {
        value: Option<Box<IrNode>>,
    },
    Break,
    Continue,
    // --- 制御構造 ---
    If {
        condition: Box<IrNode>,
        body: Vec<IrNode>,
        elif_clauses: Vec<ElifClause>,
        else_body: Vec<IrNode>,
    },
    ForRange {
        var_name: String,
        from: Box<IrNode>,
        to: Box<IrNode>,
        step: Box<IrNode>,
        body: Vec<IrNode>,
    },
    ForEach {
        var_name: String,
        iter: Box<IrNode>,
        body: Vec<IrNode>,
    },
    While {
        until: bool,
        condition: Box<IrNode>,
        body: Vec<IrNode>,
    },
    // --- 関数 ---
    FuncDef {
        name: String,
        params: Vec<String>,
        body: Vec<IrNode>,
        has_return: bool,
    },
    FuncCallStmt {
        name: String,
        args: Vec<IrNode>,
    },
    // --- 式 ---
    VarRef {
        name: String,
    },
    NumLit {
        value: f64,
    },
    StrLit {
        value: String,
    },
    BoolLit {
        value: bool,
    },
    ListLit {
        items: Vec<IrNode>,
    },
    BinOp {
        op: String,
        left: Box<IrNode>,
        right: Box<IrNode>,
    },
    Compare {
        op: String,
        left: Box<IrNode>,
        right: Box<IrNode>,
    },
    BoolOp {
        op: String,
        values: Vec<IrNode>,
    },
    Not {
        operand: Box<IrNode>,
    },
    FuncCallExpr {
        name: String,
        args: Vec<IrNode>,
    },
    FStringLit {
        parts: Vec<IrNode>,
    },
    Subscript {
        value: Box<IrNode>,
        index: Box<IrNode>,
    },
    Unsupported {
        node_type: String,
        code: String,
    },
}

#[derive(Serialize, Debug, Clone)]
pub struct ElifClause {
    pub condition: IrNode,
    pub body: Vec<IrNode>,
}
