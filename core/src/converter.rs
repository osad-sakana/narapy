use crate::ir::{ElifClause, IrNode};
use rustpython_parser::ast::{
    BoolOp, CmpOp, Constant, Expr, Operator, Ranged, Stmt, StmtIf, UnaryOp,
};

pub fn convert_stmts(stmts: &[Stmt], source: &str) -> Vec<IrNode> {
    stmts
        .iter()
        .filter_map(|s| convert_stmt(s, source))
        .collect()
}

fn convert_stmt(stmt: &Stmt, source: &str) -> Option<IrNode> {
    match stmt {
        Stmt::Expr(s) => match s.value.as_ref() {
            Expr::Call(call) => {
                if let Expr::Name(name_node) = call.func.as_ref() {
                    let fname = name_node.id.as_str();
                    if fname == "print" {
                        let val = if call.args.is_empty() {
                            IrNode::StrLit {
                                value: String::new(),
                            }
                        } else {
                            convert_expr(&call.args[0], source)
                        };
                        return Some(IrNode::PrintStmt {
                            value: Box::new(val),
                        });
                    }
                    let args = call.args.iter().map(|a| convert_expr(a, source)).collect();
                    return Some(IrNode::FuncCallStmt {
                        name: fname.to_string(),
                        args,
                    });
                }
                Some(IrNode::Unsupported {
                    node_type: "ExprStmt(ComplexCall)".to_string(),
                    code: extract_source(source, s),
                })
            }
            _ => None,
        },
        Stmt::Assign(s) => {
            let target = match s.targets.first() {
                Some(t) => t,
                None => {
                    return Some(IrNode::Unsupported {
                        node_type: "AssignNoTarget".to_string(),
                        code: extract_source(source, s),
                    })
                }
            };
            match target {
                Expr::Name(name) => {
                    let value = convert_expr(&s.value, source);
                    Some(IrNode::Assign {
                        var_name: name.id.to_string(),
                        value: Box::new(value),
                    })
                }
                Expr::Attribute(attr) => {
                    if let Expr::Name(obj) = attr.value.as_ref() {
                        if obj.id.as_str() == "self" {
                            let value = convert_expr(&s.value, source);
                            return Some(IrNode::SelfAttrAssign {
                                attr: attr.attr.to_string(),
                                value: Box::new(value),
                            });
                        }
                    }
                    Some(IrNode::Unsupported {
                        node_type: "AssignComplexTarget".to_string(),
                        code: extract_source(source, s),
                    })
                }
                _ => Some(IrNode::Unsupported {
                    node_type: "AssignComplexTarget".to_string(),
                    code: extract_source(source, s),
                }),
            }
        }
        Stmt::Return(s) => {
            let value = s.value.as_ref().map(|v| Box::new(convert_expr(v, source)));
            Some(IrNode::Return { value })
        }
        Stmt::Break(_) => Some(IrNode::Break),
        Stmt::Continue(_) => Some(IrNode::Continue),
        Stmt::If(s) => Some(convert_if(s, source)),
        Stmt::For(s) => {
            let body = convert_stmts(&s.body, source);
            if let Expr::Name(target) = s.target.as_ref() {
                let var_name = target.id.to_string();
                if is_range_call(&s.iter) {
                    // range() 呼び出しだが引数が1つでない場合は未対応
                    return Some(
                        try_convert_range(&s.iter, &var_name, body, source).unwrap_or_else(|| {
                            IrNode::Unsupported {
                                node_type: "ForRange(multi-arg)".to_string(),
                                code: extract_source(source, s),
                            }
                        }),
                    );
                }
                let iter = convert_expr(&s.iter, source);
                Some(IrNode::ForEach {
                    var_name,
                    iter: Box::new(iter),
                    body,
                })
            } else {
                Some(IrNode::Unsupported {
                    node_type: "ForComplexTarget".to_string(),
                    code: extract_source(source, s),
                })
            }
        }
        Stmt::While(s) => {
            let (until, condition) = match s.test.as_ref() {
                Expr::UnaryOp(u) if matches!(u.op, UnaryOp::Not) => {
                    (true, convert_expr(&u.operand, source))
                }
                other => (false, convert_expr(other, source)),
            };
            let body = convert_stmts(&s.body, source);
            Some(IrNode::While {
                until,
                condition: Box::new(condition),
                body,
            })
        }
        Stmt::FunctionDef(s) => {
            let params: Vec<String> = s.args.args.iter().map(|a| a.def.arg.to_string()).collect();
            let body = convert_stmts(&s.body, source);
            let has_return = body_has_return(&s.body);
            Some(IrNode::FuncDef {
                name: s.name.to_string(),
                params,
                body,
                has_return,
            })
        }
        Stmt::AugAssign(s) => {
            if let Expr::Name(target) = s.target.as_ref() {
                let op = binop_to_str(&s.op);
                let value = convert_expr(&s.value, source);
                Some(IrNode::AugAssign {
                    var_name: target.id.to_string(),
                    op,
                    value: Box::new(value),
                })
            } else {
                Some(IrNode::Unsupported {
                    node_type: "AugAssignComplexTarget".to_string(),
                    code: extract_source(source, s),
                })
            }
        }
        Stmt::ClassDef(s) => {
            if s.bases.len() > 1 {
                return Some(IrNode::Unsupported {
                    node_type: "ClassDef(MultipleInheritance)".to_string(),
                    code: extract_source(source, s),
                });
            }
            if !s.decorator_list.is_empty() {
                return Some(IrNode::Unsupported {
                    node_type: "ClassDef(Decorator)".to_string(),
                    code: extract_source(source, s),
                });
            }
            let base = if let Some(base_expr) = s.bases.first() {
                if let Expr::Name(b) = base_expr {
                    Some(b.id.to_string())
                } else {
                    return Some(IrNode::Unsupported {
                        node_type: "ClassDef(ComplexBase)".to_string(),
                        code: extract_source(source, s),
                    });
                }
            } else {
                None
            };
            let body = convert_class_body(&s.body, source);
            Some(IrNode::ClassDef {
                name: s.name.to_string(),
                base,
                body,
            })
        }
        Stmt::Pass(_) => None,
        _ => Some(IrNode::Unsupported {
            node_type: stmt_type_name(stmt).to_string(),
            code: extract_source(source, stmt),
        }),
    }
}

fn convert_class_body(stmts: &[Stmt], source: &str) -> Vec<IrNode> {
    stmts
        .iter()
        .filter_map(|s| convert_class_stmt(s, source))
        .collect()
}

fn convert_class_stmt(stmt: &Stmt, source: &str) -> Option<IrNode> {
    match stmt {
        Stmt::FunctionDef(s) => {
            if !s.decorator_list.is_empty() {
                return Some(IrNode::Unsupported {
                    node_type: "MethodDef(Decorator)".to_string(),
                    code: extract_source(source, s),
                });
            }
            // selfを除いたパラメータリスト
            let params: Vec<String> = s
                .args
                .args
                .iter()
                .skip(1)
                .map(|a| a.def.arg.to_string())
                .collect();
            let body = convert_stmts(&s.body, source);
            let has_return = body_has_return(&s.body);
            if s.name.as_str() == "__init__" {
                Some(IrNode::InitDef { params, body })
            } else {
                Some(IrNode::MethodDef {
                    name: s.name.to_string(),
                    params,
                    body,
                    has_return,
                })
            }
        }
        Stmt::Pass(_) => None,
        _ => Some(IrNode::Unsupported {
            node_type: "ClassBody(NonMethod)".to_string(),
            code: extract_source(source, stmt),
        }),
    }
}

/// ソースコードのバイト範囲からテキストを切り出す
fn extract_source(source: &str, node: &impl Ranged) -> String {
    let start = u32::from(node.range().start()) as usize;
    let end = u32::from(node.range().end()) as usize;
    source.get(start..end).unwrap_or("").trim().to_string()
}

/// if/elif/else をIRに変換する。
/// rustpython-parserでは elif は orelse の中に単一の If として入る。
fn convert_if(s: &StmtIf, source: &str) -> IrNode {
    let condition = convert_expr(&s.test, source);
    let body = convert_stmts(&s.body, source);
    let mut elif_clauses = Vec::new();
    let mut else_body = Vec::new();

    let mut current_orelse = s.orelse.as_slice();
    loop {
        if current_orelse.is_empty() {
            break;
        }
        if current_orelse.len() == 1 {
            if let Stmt::If(inner) = &current_orelse[0] {
                elif_clauses.push(ElifClause {
                    condition: convert_expr(&inner.test, source),
                    body: convert_stmts(&inner.body, source),
                });
                current_orelse = inner.orelse.as_slice();
                continue;
            }
        }
        else_body = convert_stmts(current_orelse, source);
        break;
    }

    IrNode::If {
        condition: Box::new(condition),
        body,
        elif_clauses,
        else_body,
    }
}

/// iter が `range(...)` 呼び出しかどうかだけを判定する
fn is_range_call(iter: &Expr) -> bool {
    if let Expr::Call(call) = iter {
        if let Expr::Name(fname) = call.func.as_ref() {
            return fname.id.as_str() == "range";
        }
    }
    false
}

/// `range(stop)` （1引数のみ、かつ変数名が `_` でない）を ForRange に変換。
/// 条件を満たさない場合は None を返す。
fn try_convert_range(
    iter: &Expr,
    var_name: &str,
    body: Vec<IrNode>,
    source: &str,
) -> Option<IrNode> {
    if let Expr::Call(call) = iter {
        if let Expr::Name(fname) = call.func.as_ref() {
            if fname.id.as_str() == "range" && call.args.len() == 1 && var_name != "_" {
                return Some(IrNode::ForRange {
                    var_name: var_name.to_string(),
                    from: Box::new(IrNode::NumLit { value: 0.0 }),
                    to: Box::new(convert_expr(&call.args[0], source)),
                    step: Box::new(IrNode::NumLit { value: 1.0 }),
                    body,
                });
            }
        }
    }
    None
}

fn convert_expr(expr: &Expr, source: &str) -> IrNode {
    match expr {
        Expr::Constant(c) => convert_constant(&c.value),
        Expr::Name(n) => IrNode::VarRef {
            name: n.id.to_string(),
        },
        Expr::BinOp(b) => {
            let op = binop_to_str(&b.op);
            IrNode::BinOp {
                op,
                left: Box::new(convert_expr(&b.left, source)),
                right: Box::new(convert_expr(&b.right, source)),
            }
        }
        Expr::BoolOp(b) => {
            let op = match b.op {
                BoolOp::And => "AND",
                BoolOp::Or => "OR",
            }
            .to_string();
            let values = b.values.iter().map(|v| convert_expr(v, source)).collect();
            IrNode::BoolOp { op, values }
        }
        Expr::Compare(c) => {
            let op = cmpop_to_str(c.ops.first().unwrap_or(&CmpOp::Eq));
            let right = c
                .comparators
                .first()
                .map(|r| convert_expr(r, source))
                .unwrap_or(IrNode::Unsupported {
                    node_type: "EmptyComparator".to_string(),
                    code: String::new(),
                });
            IrNode::Compare {
                op,
                left: Box::new(convert_expr(&c.left, source)),
                right: Box::new(right),
            }
        }
        Expr::UnaryOp(u) => match u.op {
            UnaryOp::Not => IrNode::Not {
                operand: Box::new(convert_expr(&u.operand, source)),
            },
            UnaryOp::USub => {
                if let Expr::Constant(c) = u.operand.as_ref() {
                    if let Constant::Int(i) = &c.value {
                        let v: f64 = i.to_string().parse().unwrap_or(0.0);
                        return IrNode::NumLit { value: -v };
                    }
                    if let Constant::Float(f) = &c.value {
                        return IrNode::NumLit { value: -f };
                    }
                }
                IrNode::Unsupported {
                    node_type: "UnaryUSub".to_string(),
                    code: extract_source(source, u),
                }
            }
            _ => IrNode::Unsupported {
                node_type: "UnaryOp".to_string(),
                code: extract_source(source, u),
            },
        },
        Expr::Call(c) => {
            if let Expr::Name(fname) = c.func.as_ref() {
                let name = fname.id.as_str();
                let args = c.args.iter().map(|a| convert_expr(a, source)).collect();
                // 先頭が大文字はクラスのインスタンス生成とみなす（Python慣習）
                if name
                    .chars()
                    .next()
                    .map(|ch| ch.is_uppercase())
                    .unwrap_or(false)
                {
                    return IrNode::InstanceCreate {
                        class_name: name.to_string(),
                        args,
                    };
                }
                IrNode::FuncCallExpr {
                    name: name.to_string(),
                    args,
                }
            } else {
                IrNode::Unsupported {
                    node_type: "ComplexCall".to_string(),
                    code: extract_source(source, c),
                }
            }
        }
        Expr::Attribute(a) => {
            if let Expr::Name(obj) = a.value.as_ref() {
                if obj.id.as_str() == "self" {
                    return IrNode::SelfAttrRef {
                        attr: a.attr.to_string(),
                    };
                }
            }
            IrNode::Unsupported {
                node_type: "Attribute".to_string(),
                code: extract_source(source, a),
            }
        }
        Expr::List(l) => {
            let items = l.elts.iter().map(|e| convert_expr(e, source)).collect();
            IrNode::ListLit { items }
        }
        Expr::Subscript(s) => IrNode::Subscript {
            value: Box::new(convert_expr(&s.value, source)),
            index: Box::new(convert_expr(&s.slice, source)),
        },
        Expr::JoinedStr(s) => {
            let parts: Vec<IrNode> = s
                .values
                .iter()
                .filter_map(|v| match v {
                    Expr::Constant(c) => {
                        if let Constant::Str(text) = &c.value {
                            if text.is_empty() {
                                None
                            } else {
                                Some(IrNode::StrLit {
                                    value: text.clone(),
                                })
                            }
                        } else {
                            None
                        }
                    }
                    Expr::FormattedValue(fv) => Some(convert_expr(&fv.value, source)),
                    _ => None,
                })
                .collect();
            IrNode::FStringLit { parts }
        }
        _ => IrNode::Unsupported {
            node_type: expr_type_name(expr).to_string(),
            code: extract_source(source, expr),
        },
    }
}

fn convert_constant(c: &Constant) -> IrNode {
    match c {
        Constant::Int(i) => IrNode::NumLit {
            value: i.to_string().parse().unwrap_or(0.0),
        },
        Constant::Float(f) => IrNode::NumLit { value: *f },
        Constant::Str(s) => IrNode::StrLit { value: s.clone() },
        Constant::Bool(b) => IrNode::BoolLit { value: *b },
        Constant::None => IrNode::Unsupported {
            node_type: "None".to_string(),
            code: "None".to_string(),
        },
        _ => IrNode::Unsupported {
            node_type: "Constant".to_string(),
            code: String::new(),
        },
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
    }
    .to_string()
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
    }
    .to_string()
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
        Expr::Subscript(_) => "Subscript",
        Expr::Starred(_) => "Starred",
        Expr::Tuple(_) => "Tuple",
        _ => "UnknownExpr",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustpython_parser::{ast::Suite, Parse};

    fn parse_ir(src: &str) -> Vec<IrNode> {
        let suite = Suite::parse(src, "<test>").expect("parse failed");
        convert_stmts(&suite, src)
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
        if let IrNode::If {
            elif_clauses,
            else_body,
            ..
        } = &nodes[0]
        {
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
        assert!(matches!(
            &nodes[0],
            IrNode::FuncDef {
                has_return: true,
                ..
            }
        ));
    }

    #[test]
    fn test_unsupported_has_code() {
        let src = "import os";
        let nodes = parse_ir(src);
        assert!(matches!(&nodes[0], IrNode::Unsupported { code, .. } if code == "import os"));
    }

    #[test]
    fn test_for_range_multi_arg_unsupported() {
        let src = "for i in range(0, 10):\n  pass";
        let nodes = parse_ir(src);
        assert!(matches!(&nodes[0], IrNode::Unsupported { .. }));
    }

    #[test]
    fn test_for_underscore_range_unsupported() {
        let src = "for _ in range(10):\n  pass";
        let nodes = parse_ir(src);
        assert!(matches!(&nodes[0], IrNode::Unsupported { .. }));
    }

    #[test]
    fn test_class_def_no_base() {
        let src = "class MyClass:\n  pass";
        let nodes = parse_ir(src);
        assert!(
            matches!(&nodes[0], IrNode::ClassDef { name, base: None, .. } if name == "MyClass")
        );
    }

    #[test]
    fn test_class_def_with_base() {
        let src = "class Dog(Animal):\n  pass";
        let nodes = parse_ir(src);
        assert!(
            matches!(&nodes[0], IrNode::ClassDef { name, base: Some(b), .. } if name == "Dog" && b == "Animal")
        );
    }

    #[test]
    fn test_class_init_def() {
        let src = "class MyClass:\n  def __init__(self, x):\n    self.x = x";
        let nodes = parse_ir(src);
        if let IrNode::ClassDef { body, .. } = &nodes[0] {
            assert!(matches!(&body[0], IrNode::InitDef { params, .. } if params == &["x"]));
            if let IrNode::InitDef {
                body: init_body, ..
            } = &body[0]
            {
                assert!(
                    matches!(&init_body[0], IrNode::SelfAttrAssign { attr, .. } if attr == "x")
                );
            }
        } else {
            panic!("expected ClassDef");
        }
    }

    #[test]
    fn test_class_method_def() {
        let src = "class MyClass:\n  def greet(self):\n    return self.name";
        let nodes = parse_ir(src);
        if let IrNode::ClassDef { body, .. } = &nodes[0] {
            assert!(matches!(&body[0], IrNode::MethodDef { name, .. } if name == "greet"));
        } else {
            panic!("expected ClassDef");
        }
    }

    #[test]
    fn test_self_attr_ref() {
        let src = "class MyClass:\n  def get_x(self):\n    return self.x";
        let nodes = parse_ir(src);
        if let IrNode::ClassDef { body, .. } = &nodes[0] {
            if let IrNode::MethodDef {
                body: method_body, ..
            } = &body[0]
            {
                assert!(
                    matches!(&method_body[0], IrNode::Return { value: Some(v), .. } if matches!(v.as_ref(), IrNode::SelfAttrRef { attr } if attr == "x"))
                );
            }
        }
    }

    #[test]
    fn test_instance_create() {
        let src = "obj = MyClass(1, 2)";
        let nodes = parse_ir(src);
        if let IrNode::Assign { value, .. } = &nodes[0] {
            assert!(
                matches!(value.as_ref(), IrNode::InstanceCreate { class_name, .. } if class_name == "MyClass")
            );
        } else {
            panic!("expected Assign");
        }
    }

    #[test]
    fn test_class_multiple_inheritance_unsupported() {
        let src = "class MyClass(A, B):\n  pass";
        let nodes = parse_ir(src);
        assert!(matches!(&nodes[0], IrNode::Unsupported { .. }));
    }
}
