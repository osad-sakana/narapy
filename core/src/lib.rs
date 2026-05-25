mod converter;
mod ir;

use rustpython_parser::parse_program;
use wasm_bindgen::prelude::*;

use converter::convert_stmts;
use ir::IrNode;

/// Pythonソースを解析してBlockly用IR JSONを返す。
/// 構文エラー時はJsErrorをthrowする。
#[wasm_bindgen]
pub fn python_to_ir(source: &str) -> Result<String, JsError> {
    let suite = parse_program(source, "<input>")
        .map_err(|e| JsError::new(&e.to_string()))?;
    let body = convert_stmts(&suite);
    let root = IrNode::Program { body };
    serde_json::to_string(&root).map_err(|e| JsError::new(&e.to_string()))
}

/// 後方互換用: 構文チェックのみ行い { "status": "success" } を返す。
#[wasm_bindgen]
pub fn parse_and_validate(source: &str) -> Result<String, JsError> {
    parse_program(source, "<input>")
        .map_err(|e| JsError::new(&e.to_string()))?;
    Ok(r#"{"status":"success"}"#.to_string())
}
