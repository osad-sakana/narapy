import { describe, expect, it, vi } from 'vitest'

const appendLog = vi.fn()
const appendErrorBlock = vi.fn()

vi.mock('../runner/log', () => ({
  appendLog: (...args: unknown[]) => appendLog(...args),
  appendErrorBlock: (...args: unknown[]) => appendErrorBlock(...args),
}))

const { renderGradeResult } = await import('./resultLog')

// errorTranslator.tsが実際に翻訳できる形式（<exec>付きトレースバック）
const TRANSLATABLE_TRACEBACK =
  'Traceback (most recent call last):\n  File "<exec>", line 2, in <module>\nTypeError: unsupported operand type(s) for +: \'int\' and \'str\''

describe('renderGradeResult', () => {
  it('合格ケースは✓付きでresultとして表示する', () => {
    appendLog.mockClear()
    renderGradeResult(JSON.stringify({ cases: [{ name: 'test_add', passed: true, message: null }], error: null }))

    expect(appendLog).toHaveBeenCalledWith('✓ test_add', 'result')
    expect(appendErrorBlock).not.toHaveBeenCalled()
  })

  it('AssertionErrorの独自メッセージ（翻訳ルールにマッチしない素の日本語）はそのまま表示する', () => {
    appendLog.mockClear()
    appendErrorBlock.mockClear()
    renderGradeResult(JSON.stringify({
      cases: [{ name: 'test_add', passed: false, message: '1+2は3のはず' }],
      error: null,
    }))

    expect(appendLog).toHaveBeenCalledWith('✗ test_add: 1+2は3のはず', 'error')
    expect(appendErrorBlock).not.toHaveBeenCalled()
  })

  it('通常実行と同じトレースバック形式の例外はerrorTranslatorで翻訳してappendErrorBlockへ渡す', () => {
    appendLog.mockClear()
    appendErrorBlock.mockClear()
    renderGradeResult(JSON.stringify({
      cases: [{ name: 'test_add', passed: false, message: TRANSLATABLE_TRACEBACK }],
      error: null,
    }))

    expect(appendLog).toHaveBeenCalledWith('✗ test_add', 'error')
    expect(appendErrorBlock).toHaveBeenCalledTimes(1)
    const block = appendErrorBlock.mock.calls[0][0]
    expect(block.errorType).toBe('TypeError')
    expect(block.matched).toBe(true)
    expect(block.raw).toBe(TRANSLATABLE_TRACEBACK)
  })

  it('result.errorが案内文（翻訳ルールにマッチしない）ならそのまま表示する', () => {
    appendLog.mockClear()
    appendErrorBlock.mockClear()
    renderGradeResult(JSON.stringify({ cases: [], error: 'test_ から始まる関数が見つかりません' }))

    expect(appendLog).toHaveBeenCalledWith('[採点エラー] test_ から始まる関数が見つかりません', 'error')
    expect(appendErrorBlock).not.toHaveBeenCalled()
  })

  it('result.errorがSyntaxError形式なら翻訳してappendErrorBlockへ渡す', () => {
    appendLog.mockClear()
    appendErrorBlock.mockClear()
    const syntaxError = 'File "<exec>", line 1\n    def f(:\nSyntaxError: invalid syntax'
    renderGradeResult(JSON.stringify({ cases: [], error: syntaxError }))

    expect(appendLog).toHaveBeenCalledWith('[採点エラー]', 'error')
    expect(appendErrorBlock).toHaveBeenCalledTimes(1)
    expect(appendErrorBlock.mock.calls[0][0].errorType).toBe('SyntaxError')
  })

  it('JSONとして壊れている場合は解析失敗として表示する', () => {
    appendLog.mockClear()
    renderGradeResult('not json')

    expect(appendLog).toHaveBeenCalledWith('[採点エラー] 採点結果の解析に失敗しました', 'error')
  })

  it('合格件数のサマリー行を最後に表示する', () => {
    appendLog.mockClear()
    renderGradeResult(JSON.stringify({
      cases: [
        { name: 'test_a', passed: true, message: null },
        { name: 'test_b', passed: false, message: '不合格' },
      ],
      error: null,
    }))

    expect(appendLog).toHaveBeenLastCalledWith('--- 採点結果: 1 / 2 件 合格 ---', 'info')
  })
})
