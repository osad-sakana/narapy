// Python の input() を差し替えるモジュール。_narapy_io として sys.modules に登録され、
// __main__ の名前空間を汚さない（turtleModule.ts と同じ方針）。
//
// builtins.input を差し替えることで、__main__ だけでなく import した自作モジュール内の
// input() も同じ経路で扱える。JS 側の read_input(prompt, preview) は Atomics.wait で
// メインスレッドの入力を待つ。キャンセル（停止操作）は None が返り、KeyboardInterrupt にする。
//
// 入力値は呼び出し時点の sys.stdout へ「プロンプト+入力値」の1行としてエコーする。
// 通常実行では実行ログへ、ステップ実行の記録中は _CappedStdout を経由して各ステップの
// stdout に入るため、再生時の「ここまでの出力」にも対話の履歴が残る。
export const INPUT_MODULE_SRC = String.raw`
import sys as _sys
import builtins as _builtins


def install(read_input):
    def __narapy_input__(prompt=""):
        prompt = str(prompt)
        out = _sys.stdout
        # print("名前: ", end="") のような改行無しの出力を、入力待ちの間もログに見せる
        try:
            out.flush()
        except Exception:
            pass
        # ステップ実行の記録中は print がバッファへ隠れるため、未表示分を取り出して渡す
        take = getattr(out, "take_input_preview", None)
        preview = take() if take is not None else None
        value = read_input(prompt, preview)
        if value is None:
            raise KeyboardInterrupt()
        out.write(prompt + value + "\n")
        mark = getattr(out, "mark_input_echoed", None)
        if mark is not None:
            mark()
        return value

    _builtins.input = __narapy_input__
`
