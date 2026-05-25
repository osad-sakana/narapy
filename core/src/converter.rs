use rustpython_parser::ast::{
    Stmt, Expr, Constant, Operator, BoolOp, CmpOp, UnaryOp, StmtIf,
};
use crate::ir::{IrNode, ElifClause};

pub fn convert_stmts(stmts: &[Stmt]) -> Vec<IrNode> {
    stmts.iter().filter_map(|s| convert_stmt(s)).collect()
}

fn convert_stmt(stmt: &Stmt) -> Option<IrNode> {
    match stmt {
        Stmt::Expr(s) => {
            match s.value.as_ref() {
                Expr::Call(call) => {
                    if let Expr::Name(name_node) = call.func.as_ref() {
                        let fname = name_node.id.as_str();
                        // print() → PrintStmt
                        if fname == "print" {
                            let val = if call.args.is_empty() {
                                IrNode::StrLit { value: String::new() }
                            } else {
                                convert_expr(&call.args[0])
                            };
                            return Some(IrNode::PrintStmt { value: Box::new(val) });
                        }
                        // その他の関数呼び出し文
                        let args = call.args.iter().map(convert_expr).collect();
                        return Some(IrNode::FuncCallStmt {
                            name: fname.to_string(),
                            args,
                        });
                    }
                    Some(IrNode::Unsupported { node_type: "ExprStmt(ComplexCall)".to_string() })
                }
                _ => None,
            }
        }
        Stmt::Assign(s) => {
            if let Some(Expr::Name(target)) = s.targets.first() {
                let value = convert_expr(&s.value);
                Some(IrNode::Assign {
                    var_name: target.id.to_string(),
                    value: Box::new(value),
                })
            } else {
                Some(IrNode::Unsupported { node_type: "AssignComplexTarget".to_string() })
            }
        }
        Stmt::Return(s) => {
            let value = s.value.as_ref().map(|v| Box::new(convert_expr(v)));
            Some(IrNode::Return { value })
        }
        Stmt::Break(_) => Some(IrNode::Break),
        Stmt::Continue(_) => Some(IrNode::Continue),
        Stmt::If(s) => Some(convert_if(s)),
        Stmt::For(s) => {
            let body = convert_stmts(&s.body);
            // ターゲットが単純な変数名の場合のみ対応
            if let Expr::Name(target) = s.target.as_ref() {
                let var_name = target.id.to_string();
                // range() 呼び出しか確認
                if let Some(range_node) = try_convert_range(&s.iter, &var_name, body.clone()) {
                    return Some(range_node);
                }
                // 通常のforEach
                let iter = convert_expr(&s.iter);
                Some(IrNode::ForEach {
                    var_name,
                    iter: Box::new(iter),
                    body,
                })
            } else {
                Some(IrNode::Unsupported { node_type: "ForComplexTarget".to_string() })
            }
        }
        Stmt::While(s) => {
            // `while not cond` → until=true
            let (until, condition) = match s.test.as_ref() {
                Expr::UnaryOp(u) if matches!(u.op, UnaryOp::Not) => {
                    (true, convert_expr(&u.operand))
                }
                other => (false, convert_expr(other)),
            };
            let body = convert_stmts(&s.body);
            Some(IrNode::While { until, condition: Box::new(condition), body })
        }
        Stmt::FunctionDef(s) => {
            let params: Vec<String> = s.args.args.iter()
                .map(|a| a.def.arg.to_string())
                .collect();
            let body = convert_stmts(&s.body);
            let has_return = body_has_return(&s.body);
            Some(IrNode::FuncDef {
                name: s.name.to_string(),
                params,
                body,
                has_return,
            })
        }
        Stmt::Pass(_) => None,
        _ => Some(IrNode::Unsupported { node_type: stmt_type_name(stmt).to_string() }),
    }
}

/// if/elif/else をIRに変換する。
/// rustpython-parserでは elif は orelse の中に単一の If として入る。
fn convert_if(s: &StmtIf) -> IrNode {
    let condition = convert_expr(&s.test);
    let body = convert_stmts(&s.body);
    let mut elif_clauses = Vec::new();
    let mut else_body = Vec::new();

    let mut current_orelse = s.orelse.as_slice();
    loop {
        if current_orelse.is_empty() {
            break;
        }
        // elif は orelse が [Stmt::If(...)] の1要素
        if current_orelse.len() == 1 {
            if let Stmt::If(inner) = &current_orelse[0] {
                elif_clauses.push(ElifClause {
                    condition: convert_expr(&inner.test),
                    body: convert_stmts(&inner.body),
                });
                current_orelse = inner.orelse.as_slice();
                continue;
            }
        }
        // else ブロック
        else_body = convert_stmts(current_orelse);
        break;
    }

    IrNode::If { condition: Box::new(condition), body, elif_clauses, else_body }
}

/// `range(stop)` / `range(start, stop)` / `range(start, stop, step)` を ForRange に変換
fn try_convert_range(iter: &Expr, var_name: &str, body: Vec<IrNode>) -> Option<IrNode> {
    if let Expr::Call(call) = iter {
        if let Expr::Name(fname) = call.func.as_ref() {
            if fname.id.as_str() != "range" {
                return None;
            }
            let (from, to, step) = match call.args.len() {
                1 => (
                    IrNode::NumLit { value: 0.0 },
                    convert_expr(&call.args[0]),
                    IrNode::NumLit { value: 1.0 },
                ),
                2 => (
                    convert_expr(&call.args[0]),
                    convert_expr(&call.args[1]),
                    IrNode::NumLit { value: 1.0 },
                ),
                3 => (
                    convert_expr(&call.args[0]),
                    convert_expr(&call.args[1]),
                    convert_expr(&call.args[2]),
                ),
                _ => return None,
            };
            return Some(IrNode::ForRange {
                var_name: var_name.to_string(),
                from: Box::new(from),
                to: Box::new(to),
                step: Box::new(step),
                body,
            });
        }
    }
    None
}

fn convert_expr(expr: &Expr) -> IrNode {
    match expr {
        Expr::Constant(c) => convert_constant(&c.value),
        Expr::Name(n) => IrNode::VarRef { name: n.id.to_string() },
        Expr::BinOp(b) => {
            let op = binop_to_str(&b.op);
            IrNode::BinOp {
                op,
                left: Box::new(convert_expr(&b.left)),
                right: Box::new(convert_expr(&b.right)),
            }
        }
        Expr::BoolOp(b) => {
            let op = match b.op {
                BoolOp::And => "AND",
                BoolOp::Or => "OR",
            }.to_string();
            let values = b.values.iter().map(convert_expr).collect();
            IrNode::BoolOp { op, values }
        }
        Expr::Compare(c) => {
            let op = cmpop_to_str(c.ops.first().unwrap_or(&CmpOp::Eq));
            let right = c.comparators.first()
                .map(convert_expr)
                .unwrap_or(IrNode::Unsupported { node_type: "EmptyComparator".to_string() });
            IrNode::Compare {
                op,
                left: Box::new(convert_expr(&c.left)),
                right: Box::new(right),
            }
        }
        Expr::UnaryOp(u) => match u.op {
            UnaryOp::Not => IrNode::Not { operand: Box::new(convert_expr(&u.operand)) },
            UnaryOp::USub => {
                // 負の数リテラル: -5 → NumLit(-5)
                if let Expr::Constant(c) = u.operand.as_ref() {
                    if let Constant::Int(i) = &c.value {
                        let v: f64 = i.to_string().parse().unwrap_or(0.0);
                        return IrNode::NumLit { value: -v };
                    }
                    if let Constant::Float(f) = &c.value {
                        return IrNode::NumLit { value: -f };
                    }
                }
                IrNode::Unsupported { node_type: "UnaryUSub".to_string() }
            }
            _ => IrNode::Unsupported { node_type: "UnaryOp".to_string() },
        },
        Expr::Call(c) => {
            if let Expr::Name(fname) = c.func.as_ref() {
                let args = c.args.iter().map(convert_expr).collect();
                IrNode::FuncCallExpr { name: fname.id.to_string(), args }
            } else {
                IrNode::Unsupported { node_type: "ComplexCall".to_string() }
            }
        }
        Expr::List(l) => {
            let items = l.elts.iter().map(convert_expr).collect();
            IrNode::ListLit { items }
        }
        _ => IrNode::Unsupported { node_type: expr_type_name(expr).to_string() },
    }
}

fn convert_constant(c: &Constant) -> IrNode {
    match c {
        Constant::Int(i) => IrNode::NumLit { value: i.to_string().parse().unwrap_or(0.0) },
        Constant::Float(f) => IrNode::NumLit { value: *f },
        Constant::Str(s) => IrNode::StrLit { value: s.clone() },
        Constant::Bool(b) => IrNode::BoolLit { value: *b },
        Constant::None => IrNode::Unsupported { node_type: "None".to_string() },
        _ => IrNode::Unsupported { node_type: "Constant".to_string() },
    }
}

fn binop_to_str(op: &Operator) -> String {
    match op {
        Operator::Add => "ADD",
        Operator::Sub => "MINUS",
        Operator::Mult => "MULTIPLY",
        Operator::Div => "DIVIDE",
        Operator::Mod => "MODULO",
        Operator::Pow => "POWER",
        Operator::FloorDiv => "DIVIDE",
        _ => "ADD",
    }.to_string()
}

fn cmpop_to_str(op: &CmpOp) -> String {
    match op {
        CmpOp::Eq => "EQ",
        CmpOp::NotEq => "NEQ",
        CmpOp::Lt => "LT",
        CmpOp::LtE => "LTE",
        CmpOp::Gt => "GT",
        CmpOp::GtE => "GTE",
        _ => "EQ",
    }.to_string()
}

fn body_has_return(stmts: &[Stmt]) -> bool {
    stmts.iter().any(|s| match s {
        Stmt::Return(_) => true,
        Stmt::If(i) => body_has_return(&i.body) || body_has_return(&i.orelse),
        Stmt::For(f) => body_has_return(&f.body),
        Stmt::While(w) => body_has_return(&w.body),
        _ => false,
    })
}

fn stmt_type_name(s: &Stmt) -> &'static str {
    match s {
        Stmt::Import(_) => "Import",
        Stmt::ImportFrom(_) => "ImportFrom",
        Stmt::ClassDef(_) => "ClassDef",
        Stmt::AugAssign(_) => "AugAssign",
        Stmt::AnnAssign(_) => "AnnAssign",
        Stmt::AsyncFunctionDef(_) => "AsyncFunctionDef",
        Stmt::AsyncFor(_) => "AsyncFor",
        Stmt::AsyncWith(_) => "AsyncWith",
        Stmt::Try(_) => "Try",
        Stmt::Raise(_) => "Raise",
        _ => "UnknownStmt",
    }
}

fn expr_type_name(e: &Expr) -> &'static str {
    match e {
        Expr::Lambda(_) => "Lambda",
        Expr::IfExp(_) => "IfExp",
        Expr::Dict(_) => "Dict",
        Expr::Set(_) => "Set",
        Expr::ListComp(_) => "ListComp",
        Expr::Attribute(_) => "Attribute",
        Expr::Subscript(_) => "Subscript",
        Expr::Starred(_) => "Starred",
        Expr::Tuple(_) => "Tuple",
        _ => "UnknownExpr",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustpython_parser::parse_program;

    fn parse_ir(src: &str) -> Vec<IrNode> {
        let suite = parse_program(src, "<test>").expect("parse failed");
        convert_stmts(&suite)
    }

    #[test]
    fn test_print_str() {
        let nodes = parse_ir(r#"print("hello")"#);
        assert_eq!(nodes.len(), 1);
        assert!(matches!(&nodes[0], IrNode::PrintStmt { .. }));
    }

    #[test]
    fn test_assign_num() {
        let nodes = parse_ir("x = 42");
        assert!(matches!(&nodes[0], IrNode::Assign { var_name, .. } if var_name == "x"));
    }

    #[test]
    fn test_for_range() {
        let nodes = parse_ir("for i in range(10):\n  pass");
        assert!(matches!(&nodes[0], IrNode::ForRange { var_name, .. } if var_name == "i"));
    }

    #[test]
    fn test_if_elif_else() {
        let src = "if x > 0:\n  y = 1\nelif x < 0:\n  y = 2\nelse:\n  y = 3";
        let nodes = parse_ir(src);
        if let IrNode::If { elif_clauses, else_body, .. } = &nodes[0] {
            assert_eq!(elif_clauses.len(), 1);
            assert!(!else_body.is_empty());
        } else {
            panic!("expected If node");
        }
    }

    #[test]
    fn test_func_def() {
        let src = "def greet(name):\n  return name";
        let nodes = parse_ir(src);
        assert!(matches!(&nodes[0], IrNode::FuncDef { has_return: true, .. }));
    }
}
