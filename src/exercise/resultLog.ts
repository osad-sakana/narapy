import { appendLog } from '../runner/log'
import type { GradeResult } from '../types'

// 採点結果を実行ログへ描画する。既存の appendLog は textContent で書き込むため
// エスケープ済み（テスト名やメッセージはユーザーコード/test.py由来のため、
// ここでもinnerHTML等は使わない）。
export function renderGradeResult(json: string): void {
  const result = JSON.parse(json) as GradeResult

  if (result.error) {
    appendLog(`[採点エラー] ${result.error}`, 'error')
    return
  }

  for (const testCase of result.cases) {
    const mark = testCase.passed ? '✓' : '✗'
    const detail = testCase.message ? `: ${testCase.message}` : ''
    appendLog(`${mark} ${testCase.name}${detail}`, testCase.passed ? 'result' : 'error')
  }

  const passedCount = result.cases.filter(c => c.passed).length
  appendLog(`--- 採点結果: ${passedCount} / ${result.cases.length} 件 合格 ---`, 'info')
}
