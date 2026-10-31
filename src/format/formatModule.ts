// wheel は PyPI からバージョン固定で取得する。完全性ハッシュは検証していない（PyPI は同名ファイルの
// 再アップロードを禁止するが、`==` 固定で決まるのはバージョンであり、ファイル内容までは保証しない）。
// 厳密にするなら wheel を自前ホストして sha256 を照合すること。
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
        # E401 は import os, sys を2文に分割して AST が変わり rejected になるため除外する。
        # それ以外は autopep8 の既定の ignore（E226 等）と同じ
        out = _ap.fix_code(source, options={
            'aggressive': 0,
            'ignore': ['E226', 'E24', 'W50', 'W690', 'E401'],
        })
        same = _ast.dump(_ast.parse(out)) == before
    except Exception:
        return _json.dumps({'status': 'failed'})
    if not same:
        return _json.dumps({'status': 'rejected'})
    return _json.dumps({'status': 'ok', 'code': out})
`
