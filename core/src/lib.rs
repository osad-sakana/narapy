use wasm_bindgen::prelude::*;

/// PythonソースコードをパースしてバリデーションするRust製エンジンの雛形。
/// 将来的には rustpython_parser::parse() でAST生成を行う。
#[wasm_bindgen]
pub fn parse_and_validate(source: &str) -> Result<String, JsError> {
    // 本実装では rustpython_parser::parse(source, Mode::Module) でASTを生成する:
    // use rustpython_parser::{parse, Mode};
    // let _ast = parse(source, Mode::Module).map_err(|e| JsError::new(&e.to_string()))?;

    if source.contains("lambda") || source.contains('[') {
        return Err(JsError::new("サポート外の構文です"));
    }

    Ok(r#"{"status":"success"}"#.to_string())
}
