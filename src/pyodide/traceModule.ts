// Pyodide(Web Worker) 内でのステップ実行トレースは CPython 標準の sys.settrace を使う。
// 実測で確認した重要な制約（Pyodide 0.27.0 / CPython 3.12.7）:
// - sys.settrace() はそれを呼び出した「現在のフレーム」自体はトレースしない
//   （既にアクティブなフレームには局所トレース関数がインストールされないため）。
//   そのため settrace() の呼び出しと、実際にトレースしたいコードの実行は
//   必ず別フレーム（run_trace 内の exec()）で行う必要がある。
// - co_filename は compile() 時に明示的に指定したファイル名がそのまま使われる。
//   'call' イベントでこのファイル名を prefix 判定することで、ユーザーコードと
//   同じファイル内で定義された関数呼び出しは追跡しつつ、site-packages/stdlib の
//   内部呼び出しは自動的に除外できる。
//
// この文字列は _narapy_trace という独立モジュールとして sys.modules に登録され
// (traceRun.ts参照)、__main__ の名前空間を汚さない。ユーザーコード自体は
// __main__ の globals() で exec するため、input() 用に差し込んだ customInput 等の
// 既存のグローバル状態はそのまま見える。
export const TRACE_MODULE_SRC = String.raw`
import sys as _sys
import types as _types
import json as _json

_MAX_REPR = 120
_MAX_ITEMS = 50


def _is_module(value):
    return isinstance(value, _types.ModuleType)


def _safe_repr(value):
    try:
        text = repr(value)
    except Exception as e:
        return "<repr失敗: {}>".format(e)
    if len(text) > _MAX_REPR:
        return text[:_MAX_REPR] + "..."
    return text


def _snapshot(mapping, exclude=None):
    out = []
    for name, value in mapping.items():
        if name.startswith("__") and name.endswith("__"):
            continue
        if exclude is not None and name in exclude:
            continue
        if len(out) >= _MAX_ITEMS:
            out.append({"name": "...", "type": "", "value": "(以下省略)"})
            break
        out.append({"name": name, "type": type(value).__name__, "value": _safe_repr(value)})
    return out


class _Recorder:
    # self.depth は exec() が生成するモジュール直下のフレームを1として数える
    # （settrace は exec() 自身のフレームから'call'イベントを発行するため）。
    # 出力する depth はユーザーから見た自然な値にするため 1 引いて 0 起点にする。
    def __init__(self, prefix, max_steps, max_depth, known_names):
        self.prefix = prefix
        self.max_steps = max_steps
        self.max_depth = max_depth
        self.known_names = known_names
        self.depth = 0
        self.steps = []
        self.truncated = False

    def _record(self, frame, event):
        try:
            locs = dict(frame.f_locals)
        except Exception:
            locs = {}
        # モジュール直下（depth<=1）では pyodide/Narapy が予め注入した名前
        # (input, _pyodide_core 等)をユーザー変数と混同しないよう除外する
        exclude = self.known_names if self.depth <= 1 else None
        entry = {
            "line": frame.f_lineno,
            "event": event,
            "funcName": frame.f_code.co_name,
            "depth": self.depth - 1,
            "locals": _snapshot(locs, exclude),
            "globals": None,
        }
        # モジュール直下では locals がそのまま globals と同一なので別枠は不要
        if self.depth > 1:
            try:
                globs = dict(frame.f_globals)
            except Exception:
                globs = {}
            entry["globals"] = _snapshot(
                {k: v for k, v in globs.items() if not callable(v) and not _is_module(v)},
                self.known_names,
            )
        self.steps.append(entry)

    def trace(self, frame, event, arg):
        filename = frame.f_code.co_filename
        if event == "call":
            if not filename.startswith(self.prefix):
                return None
            if self.depth >= self.max_depth:
                # 再帰暴走対策: これ以上深いフレームは追跡しない(実行自体は継続する)
                return None
            self.depth += 1
            return self.trace
        if self.truncated:
            return None
        if len(self.steps) >= self.max_steps:
            # 以降は全速で完走させる（無限ループでもブラウザが固まらないようにする）
            self.truncated = True
            _sys.settrace(None)
            return None
        if event == "line" or event == "exception":
            self._record(frame, event)
        elif event == "return":
            self._record(frame, event)
            self.depth = max(0, self.depth - 1)
        return self.trace


def run_trace(source, filename, prefix, max_steps, max_depth, main_globals):
    # 直前の実行が settrace を残していないことを保証する（防御的）
    _sys.settrace(None)
    known_names = frozenset(main_globals.keys())
    recorder = _Recorder(prefix, max_steps, max_depth, known_names)
    error = None
    try:
        code_obj = compile(source, filename, "exec")
    except SyntaxError as e:
        return _json.dumps({"steps": [], "truncated": False, "error": str(e)})

    _sys.settrace(recorder.trace)
    try:
        exec(code_obj, main_globals)
    except BaseException as e:
        error = "{}: {}".format(type(e).__name__, e)
    finally:
        _sys.settrace(None)

    return _json.dumps({
        "steps": recorder.steps,
        "truncated": recorder.truncated,
        "error": error,
    })
`
