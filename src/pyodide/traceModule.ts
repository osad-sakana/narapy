// Pyodide(Web Worker) 内でのステップ実行トレースは CPython 標準の sys.settrace を使う。
// 実測で確認した重要な制約（Pyodide 0.27.0 / CPython 3.12.7）:
// - sys.settrace() はそれを呼び出した「現在のフレーム」自体はトレースしない
//   （既にアクティブなフレームには局所トレース関数がインストールされないため）。
//   そのため settrace() の呼び出しと、実際にトレースしたいコードの実行は
//   必ず別フレーム（run_trace 内の exec()）で行う必要がある。
// - co_filename は compile() 時に明示的に指定したファイル名がそのまま使われる。
//   MVPでは単一ファイル（現在エディタで表示中のファイル）のみを追跡対象とするため、
//   'call' イベントでこのファイル名との完全一致を判定する。他ファイル（importした
//   自作モジュール等）のフレームは追跡しないことで、誤って現在のファイルの行として
//   ハイライトされることを防ぐ（複数ファイルの呼び出しスタック可視化は将来拡張）。
//
// この文字列は _narapy_trace という独立モジュールとして sys.modules に登録され
// (traceRun.ts参照)、__main__ の名前空間を汚さない。ユーザーコード自体は
// __main__ の globals() で exec するため、input() 用に差し込んだ customInput 等の
// 既存のグローバル状態はそのまま見える。
export const TRACE_MODULE_SRC = String.raw`
import sys as _sys
import io as _io
import json as _json
import reprlib as _reprlib
import traceback as _traceback
import warnings as _warnings
import collections.abc as _abc
import contextlib as _contextlib
from itertools import islice as _islice

_MAX_REPR = 120
_MAX_ITEMS = 50
# 1ステップあたりに記録する標準出力の上限（巨大なprint()でJSONが肥大化しないため）。
# 通常の学習コードの1行分のprint()では実質切られない程度に余裕を持たせてある。
_MAX_STDOUT_CHUNK = 20000
# 標準出力バッファの総量上限。ステップ上限(MAX_STEPS)到達後は settrace(None) して
# 残りを全速で完走させるため、無限ループの print() がここで際限なく蓄積し続けると
# Worker のメモリを食い潰してタブがクラッシュする（MAX_STEPSが防ごうとしていたのと
# 同じ種類の問題が別経路で再発する）。バッファ自体に上限を設けて防ぐ。
_MAX_STDOUT_TOTAL = 200000


class _CappedStdout(_io.StringIO):
    # print() が触る file プロトコル(write/flush等)を保つため StringIO を継承し
    # write() だけを上書きする。上限に達した後の書き込みは黙って破棄しつつ、
    # 破棄した文字数を dropped に記録して trailingStdout に注記できるようにする。
    def __init__(self):
        super().__init__()
        self.dropped = 0

    def write(self, s):
        room = _MAX_STDOUT_TOTAL - self.tell()
        if room > 0:
            super().write(s[:room])
        self.dropped += max(0, len(s) - max(0, room))
        return len(s)


class _NarapyRepr(_reprlib.Repr):
    # reprlib.Repr.repr_dict / repr_set / repr_frozenset は islice で要素数を
    # 絞る前に全要素を sorted() 相当で並べ替えるため、要素数に比例したコストが
    # 毎ステップかかってしまう（巨大な dict/set でタブが固まる）。学習用途では
    # 並び順を保証する必要が無いため、挿入順のまま打ち切る実装に上書きする。
    def repr_dict(self, x, level):
        n = len(x)
        if n == 0:
            return "{}"
        if level <= 0:
            return "{...}"
        newlevel = level - 1
        pieces = [
            "%s: %s" % (self.repr1(k, newlevel), self.repr1(x[k], newlevel))
            for k in _islice(x, self.maxdict)
        ]
        if n > self.maxdict:
            pieces.append("...")
        return "{%s}" % ", ".join(pieces)

    def _repr_unordered(self, x, level, left, right, maxiter, empty):
        n = len(x)
        if n == 0:
            return empty
        if level <= 0:
            return left + "..." + right
        newlevel = level - 1
        pieces = [self.repr1(v, newlevel) for v in _islice(x, maxiter)]
        if n > maxiter:
            pieces.append("...")
        return left + ", ".join(pieces) + right

    def repr_set(self, x, level):
        return self._repr_unordered(x, level, "{", "}", self.maxset, "set()")

    def repr_frozenset(self, x, level):
        return self._repr_unordered(x, level, "frozenset({", "})", self.maxfrozenset, "frozenset()")

    # repr_dict/repr_set/repr_frozenset の上書きは type(x) が dict/set/frozenset
    # そのものの場合にしか効かない（reprlib は type(x).__name__ でディスパッチする
    # ため）。Counter/OrderedDict/defaultdict/UserDict のような「独自 __repr__ を
    # 持つ dict/set サブクラス」は repr_instance 経由で素の repr() が全長を構築
    # してから切られ、巨大なインスタンスで依然 O(n) のコストがかかる
    # （例: キー数は少ないが値が巨大な defaultdict、dict.keys()/.values() 等の
    # ビューオブジェクトも dict/set のサブクラスではないため同様に漏れる）。
    # ABC（Mapping/MappingView/Set）で判定することでこれらを網羅的に捕まえ、
    # 打ち切り処理へ迂回する。namedtuple は list/tuple 判定から除外し表示を保つ。
    def repr_instance(self, x, level):
        try:
            if isinstance(x, _abc.Mapping):
                return "%s(%s)" % (type(x).__name__, self.repr_dict(x, level))
            if isinstance(x, _abc.MappingView):
                return "%s(%s)" % (
                    type(x).__name__,
                    self._repr_unordered(x, level, "[", "]", self.maxset, "[]"),
                )
            if isinstance(x, _abc.Set):
                return "%s(%s)" % (
                    type(x).__name__,
                    self._repr_unordered(x, level, "{", "}", self.maxset, "{}"),
                )
            if isinstance(x, (bytes, bytearray)) and len(x) > self.maxstring:
                return _reprlib.Repr.repr_instance(self, x[: self.maxstring], level)
            if isinstance(x, (list, tuple)) and len(x) > self.maxlist and not hasattr(x, "_fields"):
                return "%s(%s)" % (
                    type(x).__name__,
                    self._repr_unordered(x, level, "[", "]", self.maxlist, "[]"),
                )
        except Exception:
            pass
        return _reprlib.Repr.repr_instance(self, x, level)


# 巨大なコレクション（例: list(range(1000000))）でも要素数で打ち切って構築するため、
# 素の repr() のように全長を作ってから切る（＝計算コストは上限なし）ことを避けられる。
_repr_printer = _NarapyRepr()
_repr_printer.maxlevel = 2
_repr_printer.maxtuple = 10
_repr_printer.maxlist = 10
_repr_printer.maxarray = 10
_repr_printer.maxdict = 10
_repr_printer.maxset = 10
_repr_printer.maxfrozenset = 10
_repr_printer.maxdeque = 10
_repr_printer.maxstring = _MAX_REPR
_repr_printer.maxlong = _MAX_REPR
_repr_printer.maxother = _MAX_REPR


def _is_module(value):
    return isinstance(value, type(_sys))


def _safe_repr(value):
    try:
        return _repr_printer.repr(value)
    except Exception as e:
        return "<repr失敗: {}>".format(e)[:_MAX_REPR]


def _snapshot(mapping, exclude_names=None, hide_callables=False):
    out = []
    for name, value in mapping.items():
        if name.startswith("__") and name.endswith("__"):
            continue
        if exclude_names is not None and name in exclude_names:
            continue
        if hide_callables and (callable(value) or _is_module(value)):
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
    def __init__(self, target_file, max_steps, max_depth, known_names, stdout_buffer):
        self.target_file = target_file
        self.max_steps = max_steps
        self.max_depth = max_depth
        self.known_names = known_names
        self.depth = 0
        self.steps = []
        self.truncated = False
        # トレース対象コードの実行中、sys.stdout はこのバッファへ redirect_stdout()
        # される（run_trace参照）。ステップを記録するたびに「前回の記録からこの時点
        # までに書き込まれた分」を差分として取り出し、そのステップに紐付ける。
        # これにより変数の可視化だけでなく標準出力もステップの進行に同期させられる。
        self.stdout_buffer = stdout_buffer
        self.stdout_pos = 0

    def _consume_stdout(self):
        text = self.stdout_buffer.getvalue()
        delta = text[self.stdout_pos:]
        self.stdout_pos = len(text)
        if len(delta) > _MAX_STDOUT_CHUNK:
            delta = delta[:_MAX_STDOUT_CHUNK] + "...(以下省略)"
        return delta

    def _record(self, frame, event):
        try:
            locs = dict(frame.f_locals)
        except Exception:
            locs = {}
        # モジュール直下（depth<=1）では pyodide/Narapy が予め注入した名前
        # (input 等)や関数・モジュール自体をユーザー変数と混同しないよう除外する
        at_module_level = self.depth <= 1
        exclude = self.known_names if at_module_level else None
        entry = {
            "line": frame.f_lineno,
            "event": event,
            "funcName": frame.f_code.co_name,
            "depth": self.depth - 1,
            "locals": _snapshot(locs, exclude, hide_callables=at_module_level),
            "globals": None,
            "stdout": self._consume_stdout(),
        }
        # モジュール直下では locals がそのまま globals と同一なので別枠は不要
        if not at_module_level:
            try:
                globs = dict(frame.f_globals)
            except Exception:
                globs = {}
            entry["globals"] = _snapshot(globs, self.known_names, hide_callables=True)
        self.steps.append(entry)

    def trace(self, frame, event, arg):
        try:
            return self._trace_inner(frame, event, arg)
        except (KeyboardInterrupt, SystemExit):
            # 停止操作(interrupt buffer)によるKeyboardInterruptはユーザーコード側へ
            # 伝播させる必要がある。ここで握り潰すと停止操作が効かなくなる。
            # 記録済みのステップは打ち切り扱いにする（実際に打ち切られているため）。
            self.truncated = True
            raise
        except BaseException:
            # トレース関数自体が例外を起こすとCPythonは黙ってトレースを解除する。
            # 警告なしに不完全な結果を返さないよう、打ち切りとして明示する。
            self.truncated = True
            _sys.settrace(None)
            return None

    def _trace_inner(self, frame, event, arg):
        filename = frame.f_code.co_filename
        if event == "call":
            if filename != self.target_file:
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


def _format_error(filename):
    # errorTranslator.ts は通常実行時のPython例外文字列（pyodideが生成する、
    # ユーザーコードのファイル名が "<exec>" になっているトレースバック）を前提に
    # 型名・行番号を抽出するため、ここでも同じ形式に合わせて "<exec>" に置換する。
    exc_type, exc_value, _tb = _sys.exc_info()
    text = "".join(_traceback.format_exception(exc_type, exc_value, _tb))
    return text.replace(filename, "<exec>").strip()


def run_trace(source, filename, max_steps, max_depth, main_globals, known_names):
    # 直前の実行が settrace を残していないことを保証する（防御的）
    _sys.settrace(None)
    known_names = frozenset(known_names)
    stdout_buffer = _CappedStdout()
    recorder = _Recorder(filename, max_steps, max_depth, known_names, stdout_buffer)

    try:
        code_obj = compile(source, filename, "exec")
    except SyntaxError:
        return _json.dumps({"steps": [], "truncated": False, "error": _format_error(filename), "trailingStdout": ""})

    error = None
    _sys.settrace(recorder.trace)
    try:
        with _warnings.catch_warnings(), _contextlib.redirect_stdout(stdout_buffer):
            # CPython 3.12 の PEP 709（内包表記のインライン化）により、トレース関数が
            # frame.f_locals に触れるだけでこの警告が出る（内包表記自体は正常なコード）。
            # 3.13 の FrameLocalsProxy 導入で発生しなくなる想定の一時的な回避。
            _warnings.filterwarnings(
                "ignore", message="assigning None to unbound local", category=RuntimeWarning,
            )
            # catch_warnings() は showwarning の差し替えも保存・復元するため、
            # ここで上書きしても with を抜ければ元に戻る。_format_error() と同様に
            # 内部の仮想ファイル名をユーザーに見せる "<exec>" へ揃える。
            _original_showwarning = _warnings.showwarning

            def _narapy_showwarning(message, category, fname, lineno, file=None, line=None):
                _original_showwarning(message, category, fname.replace(filename, "<exec>"), lineno, file, line)

            _warnings.showwarning = _narapy_showwarning
            exec(code_obj, main_globals)
    except BaseException:
        error = _format_error(filename)
    finally:
        _sys.settrace(None)

    # ステップ上限による打ち切り後は全速で実行を継続するため、それ以降に書き込まれた
    # 標準出力はどのステップにも紐付けられない。ここでまとめて回収し、最後のステップの
    # 後に「打ち切り後の出力」として表示できるようにする（redirect_stdout済みなので
    # ここで取得しないと出力が失われてしまう）。
    trailing_stdout = recorder._consume_stdout()
    if stdout_buffer.dropped:
        trailing_stdout += "\n...(出力が多すぎるため、以降 {} 文字を省略しました)".format(stdout_buffer.dropped)

    return _json.dumps({
        "steps": recorder.steps,
        "truncated": recorder.truncated,
        "error": error,
        "trailingStdout": trailing_stdout,
    })
`
