import { appendLog, appendErrorBlock } from '../runner/log'
import { translatePythonError } from '../runner/errorTranslator'
import type { GradeResult } from '../types'

// 採点結果を実行ログへ描画する。既存の appendLog/appendErrorBlock は textContent で
// 書き込むためエスケープ済み（テスト名やメッセージはユーザーコード/test.py由来のため、
// ここでもinnerHTML等は使わない）。
export function renderGradeResult(json: string): void {
  let result: GradeResult
  try {
    result = JSON.parse(json) as GradeResult
  } catch {
    appendLog('[採点エラー] 採点結果の解析に失敗しました', 'error')
    return
  }

  if (result.error) {
    appendLog(`[採点エラー] ${result.error}`, 'error')
    return
  }

  for (const testCase of result.cases) {
    if (testCase.passed) {
      appendLog(`✓ ${testCase.name}`, 'result')
      continue
    }
    // AssertionErrorの独自メッセージ（例:「1+2は3のはず」）は translatePythonError に
    // マッチしない素の日本語文なのでそのまま表示され、それ以外の例外は通常実行と同じ
    // トレースバック形式（gradeModule.ts参照）なので既存のエラー翻訳が効く
    // （issueの狙い「既存のエラー翻訳機能と組み合わせる」への対応）
    const translated = testCase.message ? translatePythonError(testCase.message) : null
    if (translated) {
      appendLog(`✗ ${testCase.name}`, 'error')
      appendErrorBlock({ ...translated, raw: testCase.message ?? '' })
    } else {
      const detail = testCase.message ? `: ${testCase.message}` : ''
      appendLog(`✗ ${testCase.name}${detail}`, 'error')
    }
  }

  const passedCount = result.cases.filter(c => c.passed).length
  appendLog(`--- 採点結果: ${passedCount} / ${result.cases.length} 件 合格 ---`, 'info')
}
