// wheel は PyPI からバージョン固定で取得する（完全性ハッシュは検証しない。PyPI は同名ファイルの
// 再アップロードを禁止しており、固定バージョンの内容は不変なため。自前ホストにする場合は
// sha256 照合を追加すること）。
// 補完 Worker（completion.worker.ts）の Pyodide 上で実行する整形コード。
// ユーザーコードの実行用 Worker とは分離されているため、名前空間を汚しても影響しない。
export const AUTOPEP8_REQUIREMENTS = ['pycodestyle==2.12.1', 'autopep8==2.3.1']

// 構文エラー判定 → autopep8（aggressive 無し: 動作を変えうる修正を避ける）→ AST 一致確認。
// 結果は JSON 文字列で返す。
export const FORMAT_PY = `
import ast as _ast, json as _json

def _narapy_format(source):
    try:
        before = _ast.dump(_ast.parse(source))
    except SyntaxError as e:
        return _json.dumps({'status': 'syntax_error', 'line': e.lineno or 1, 'msg': e.msg or ''})
    except Exception:
        return _json.dumps({'status': 'failed'})
    try:
        import autopep8 as _ap
        out = _ap.fix_code(source, options={'aggressive': 0})
        same = _ast.dump(_ast.parse(out)) == before
    except Exception:
        return _json.dumps({'status': 'failed'})
    if not same:
        return _json.dumps({'status': 'rejected'})
    return _json.dumps({'status': 'ok', 'code': out})
`
