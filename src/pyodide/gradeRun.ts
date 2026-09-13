import type { PyodideInterface } from './pyodideTypes'
import { GRADE_MODULE_SRC } from './gradeModule'

// テストケースごとにフレッシュな名前空間でexecするため、実ファイルとしては
// 書き出さない仮想パス（compile()時のファイル名ラベルとしてのみ使う）。
const USER_FILENAME = '/home/pyodide/__entry__.py'
const TEST_FILENAME = '/home/pyodide/__test__.py'

// 採点ランナー本体を _narapy_grade という独立モジュールとして sys.modules に登録する。
// __main__ を汚さない（turtle/traceモジュールの毎回フレッシュ登録と同じパターン）。
const REGISTER_GRADE_CODE = `
def __narapy_register_grade__():
    import sys as _sys, types as _types
    m = _types.ModuleType('_narapy_grade')
    exec(__grade_module_src__, m.__dict__)
    _sys.modules['_narapy_grade'] = m

__narapy_register_grade__()
`

const RUN_GRADE_CODE = `
def __narapy_run_grade__():
    import sys as _sys
    return _sys.modules['_narapy_grade'].run_tests(
        __grade_user_src__, __grade_test_src__,
        ${JSON.stringify(USER_FILENAME)}, ${JSON.stringify(TEST_FILENAME)},
        __grade_module_names__,
    )

__narapy_run_grade__()
`

const CLEANUP_CODE = `
def __narapy_cleanup_grade__():
    for n in ('__grade_module_src__', '__grade_user_src__', '__grade_test_src__', '__grade_module_names__'):
        globals().pop(n, None)

__narapy_cleanup_grade__()
`

export async function runGrade(
  pyodide: PyodideInterface,
  userCode: string,
  testCode: string,
  // プロジェクト内のトップレベル.pyファイル名（拡張子抜き）。test.pyがこれらをimportして
  // sys.modulesにキャッシュしてしまうケースに備え、テストケースごとに再importを強制する
  // ためgradeModule.tsへ渡す(issue #65 レビュー指摘対応)
  moduleNames: string[],
): Promise<string> {
  pyodide.globals.set('__grade_module_src__', GRADE_MODULE_SRC)
  await pyodide.runPythonAsync(REGISTER_GRADE_CODE)
  pyodide.globals.set('__grade_user_src__', userCode)
  pyodide.globals.set('__grade_test_src__', testCode)
  pyodide.globals.set('__grade_module_names__', moduleNames)

  try {
    return await pyodide.runPythonAsync(RUN_GRADE_CODE) as string
  } finally {
    await pyodide.runPythonAsync(CLEANUP_CODE)
  }
}
