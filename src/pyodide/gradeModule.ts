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
import sys as _sys
import traceback as _traceback


# 学生コード自身の except Exception: に飲み込まれて「なぜ不合格か」が
# 分からなくなる事故を避けるため、Exceptionではなく BaseException を継承する
class _UnsupportedInput(BaseException):
    pass


def _unsupported_input(prompt=""):
    raise _UnsupportedInput()


def _format_syntax_error(e, filename):
    # errorTranslator.ts（通常実行のエラー翻訳）に日本語化させるため、通常実行時と
    # 同じ形式（"<exec>"をファイル名ラベルにしたトレースバック）で返す。素の
    # str(e) だと内部の仮想パス（__entry__.py等）が漏れ、翻訳ルールにもマッチしない。
    detail = "".join(_traceback.format_exception_only(type(e), e))
    return detail.replace(filename, "<exec>").strip()


def _extract_test_names(test_source, filename):
    tree = _ast.parse(test_source, filename)
    names = []
    async_names = []
    for node in tree.body:
        if isinstance(node, _ast.FunctionDef) and node.name.startswith("test_"):
            names.append(node.name)
        elif isinstance(node, _ast.AsyncFunctionDef) and node.name.startswith("test_"):
            async_names.append(node.name)
    return names, async_names


def _trim_internal_frames(tb, filenames):
    # run_tests/_run_case 自身のフレームは学生には無関係なので、ユーザーコード or
    # test.py 由来のフレームに達するまで読み飛ばす（「元のエラーを表示」を煩雑にしないため）
    while tb is not None and tb.tb_frame.f_code.co_filename not in filenames:
        tb = tb.tb_next
    return tb


def _run_case(user_code, test_code, name, module_names):
    # test.py が「from main import xxx」のように学生コードをモジュールとしてimportすると、
    # sys.modules にキャッシュされてケース間で使い回されてしまい、フレッシュ実行による
    # 状態分離が壊れる（2ケース目以降は再importされず、1ケース目の状態が漏れ続ける）。
    # ケースごとにキャッシュを捨てることで、importされてもフレッシュ実行を保証する。
    for module_name in module_names:
        _sys.modules.pop(module_name, None)

    # __main__ のグローバルではなく専用の辞書で実行するが、通常実行(runPythonAsync)と
    # 同じく __name__ == "__main__" のコードが動くよう明示的に揃える。揃えないと
    # if __name__ == "__main__": の中身が採点時だけ実行されず、通常実行では合格する
    # コードが採点では不合格になってしまう。
    case_globals = {"__name__": "__main__", "input": _unsupported_input}
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


def run_tests(user_source, test_source, user_filename, test_filename, module_names):
    try:
        test_names, async_test_names = _extract_test_names(test_source, test_filename)
    except SyntaxError as e:
        return _json.dumps({"cases": [], "error": _format_syntax_error(e, test_filename)})

    if async_test_names:
        return _json.dumps({
            "cases": [],
            "error": "async def のテスト関数には対応していません: {}".format(", ".join(async_test_names)),
        })

    if not test_names:
        return _json.dumps({"cases": [], "error": "test_ から始まる関数が見つかりません"})

    duplicates = sorted({n for n in test_names if test_names.count(n) > 1})
    if duplicates:
        return _json.dumps({
            "cases": [],
            "error": "test.py内に同名の関数が複数あります: {}".format(", ".join(duplicates)),
        })

    try:
        user_code = compile(user_source, user_filename, "exec")
    except SyntaxError as e:
        return _json.dumps({"cases": [], "error": _format_syntax_error(e, user_filename)})

    try:
        test_code = compile(test_source, test_filename, "exec")
    except SyntaxError as e:
        return _json.dumps({"cases": [], "error": _format_syntax_error(e, test_filename)})

    cases = []
    for name in test_names:
        try:
            cases.append(_run_case(user_code, test_code, name, module_names))
        except _UnsupportedInput:
            cases.append({"name": name, "passed": False, "message": "採点ではinput()は使用できません"})
        except AssertionError as e:
            message = str(e) if str(e) else "期待した結果と一致しませんでした"
            cases.append({"name": name, "passed": False, "message": message})
        except (KeyboardInterrupt, SystemExit):
            # 停止操作によるものなので、採点結果を返さずそのまま上位へ伝播させる
            raise
        except Exception as e:
            tb = _trim_internal_frames(e.__traceback__, (user_filename, test_filename))
            tb_text = "".join(_traceback.format_exception(type(e), e, tb))
            cases.append({"name": name, "passed": False, "message": tb_text.replace(user_filename, "<exec>").strip()})

    return _json.dumps({"cases": cases, "error": None})
`
