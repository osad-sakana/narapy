// 演習の自動採点(issue #65)。test.py に定義された test_ から始まる関数を
// テストケースとして扱い、ユーザーコードと合わせてテストケースごとにフレッシュな
// 名前空間で実行する。フレッシュ実行にする理由: ユーザーコード + テストコードを
// 1回だけ実行して全ケースで使い回すと、あるケースでの変数の変更が別ケースへ漏れて
// 誤判定を招く（例: リストへのappendがテスト間で蓄積する）。テストケース数だけ
// ユーザーコードを再実行するコストはかかるが、学習用の短いコードが対象なので許容する。
//
// この文字列は traceModule.ts と同じパターンで _narapy_grade という独立モジュールとして
// sys.modules に登録される(gradeRun.ts参照)ため、__main__ の名前空間は汚さない。
export const GRADE_MODULE_SRC = String.raw`
import io as _io
import json as _json
import ast as _ast
import contextlib as _contextlib


def _unsupported_input(prompt=""):
    raise RuntimeError("採点ではinput()は使用できません")


def _extract_test_names(test_source, filename):
    tree = _ast.parse(test_source, filename)
    return [
        node.name for node in tree.body
        if isinstance(node, _ast.FunctionDef) and node.name.startswith("test_")
    ]


def _run_case(user_code, test_code, name):
    # input() は採点対象外(issue #65 v1スコープ)なので、使われたら分かりやすいメッセージで失敗させる
    case_globals = {"input": _unsupported_input}
    stdout_buffer = _io.StringIO()
    with _contextlib.redirect_stdout(stdout_buffer):
        exec(user_code, case_globals)
    # test_xxx() から標準出力を検証できるよう、キャプチャした出力をこの名前で渡す
    case_globals["__narapy_stdout__"] = stdout_buffer.getvalue()
    exec(test_code, case_globals)
    fn = case_globals.get(name)
    if fn is None:
        return {"name": name, "passed": False, "message": "テスト関数が見つかりません"}
    fn()
    return {"name": name, "passed": True, "message": None}


def run_tests(user_source, test_source, user_filename, test_filename):
    try:
        test_names = _extract_test_names(test_source, test_filename)
    except SyntaxError as e:
        return _json.dumps({"cases": [], "error": "テストの構文エラー: {}".format(e)})

    if not test_names:
        return _json.dumps({"cases": [], "error": "test_ から始まる関数が見つかりません"})

    try:
        user_code = compile(user_source, user_filename, "exec")
    except SyntaxError as e:
        return _json.dumps({"cases": [], "error": "コードの構文エラー: {}".format(e)})

    try:
        test_code = compile(test_source, test_filename, "exec")
    except SyntaxError as e:
        return _json.dumps({"cases": [], "error": "テストの構文エラー: {}".format(e)})

    cases = []
    for name in test_names:
        try:
            cases.append(_run_case(user_code, test_code, name))
        except AssertionError as e:
            message = str(e) if str(e) else "期待した結果と一致しませんでした"
            cases.append({"name": name, "passed": False, "message": message})
        except (KeyboardInterrupt, SystemExit):
            # 停止操作によるものなので、採点結果を返さずそのまま上位へ伝播させる
            raise
        except Exception as e:
            cases.append({"name": name, "passed": False, "message": "{}: {}".format(type(e).__name__, e)})

    return _json.dumps({"cases": cases, "error": None})
`
