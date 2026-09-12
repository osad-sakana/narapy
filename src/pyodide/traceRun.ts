import type { PyodideInterface } from './pyodideTypes'
import { TRACE_MODULE_SRC } from './traceModule'

// ユーザーコードの実行対象ファイルを判定するための仮想パス。実ファイルとしては
// 書き出されないため、アクティブファイルの実名と一致していなくても問題ない
// （compile()時のファイル名ラベルとしてのみ使う）。
const TRACE_FILENAME = '/home/pyodide/__entry__.py'
const TRACE_PREFIX = '/home/pyodide/'
// 大きすぎるトレースでタブがクラッシュしないための上限。上限到達後は
// sys.settrace(None) して残りを全速で完走させる（traceModule.ts参照）。
const MAX_STEPS = 800
// 再帰暴走時にトレース自体が無限に深くなるのを防ぐ上限
const MAX_DEPTH = 20

// トレーサ本体を _narapy_trace という独立モジュールとして sys.modules に登録する。
// __main__ の名前空間を汚さないことで、input() 用に差し込んだ customInput など
// 既存のグローバル状態と衝突しない（turtle モジュールの毎回フレッシュ登録と同じパターン）。
const REGISTER_TRACE_CODE = `
import sys as _sys, types as _types
_m = _types.ModuleType('_narapy_trace')
exec(__trace_module_src__, _m.__dict__)
_sys.modules['_narapy_trace'] = _m
del _m, _types
`

const RUN_TRACE_CODE = `
import sys as _sys
_sys.modules['_narapy_trace'].run_trace(
    __trace_src__, ${JSON.stringify(TRACE_FILENAME)}, ${JSON.stringify(TRACE_PREFIX)},
    ${MAX_STEPS}, ${MAX_DEPTH}, globals(),
)
`

// globals() をこの文字列の中で呼ぶことで、_run_trace に __main__ の実際の名前空間
// （customInput が差し込まれた input を含む）を渡す。_narapy_trace モジュール内で
// globals() を呼ぶと _narapy_trace 自身の名前空間が返ってしまうため、
// 呼び出し側（__main__ コンテキストで実行されるこの文字列）で取得する必要がある。
const CLEANUP_CODE = `
import sys as _sys
_sys.settrace(None)
for _n in ('__trace_module_src__', '__trace_src__'):
    globals().pop(_n, None)
del _n
`

export async function runTrace(pyodide: PyodideInterface, code: string): Promise<string> {
  pyodide.globals.set('__trace_module_src__', TRACE_MODULE_SRC)
  await pyodide.runPythonAsync(REGISTER_TRACE_CODE)
  pyodide.globals.set('__trace_src__', code)

  try {
    return await pyodide.runPythonAsync(RUN_TRACE_CODE) as string
  } finally {
    // settrace は run_trace 内で必ず解除されるが、Worker の強制終了以外の
    // 想定外の中断に備えて呼び出し側でも防御的に解除・後始末する
    await pyodide.runPythonAsync(CLEANUP_CODE)
  }
}
