// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorInstance } from '../editor/index'
import { initIndentVizPanel, RENDER_DEBOUNCE_MS } from './panel'

function mountDom(): void {
  document.body.innerHTML = `
    <button id="panelToggleViz"></button>
    <section>
      <aside id="vizPanel" class="flex">
        <div id="vizPanelResizeHandle"></div>
        <div id="vizPanelBody"></div>
      </aside>
    </section>`
}

function createFakeEditor(initial: string) {
  let value = initial
  const handlers = { content: [] as (() => void)[], model: [] as (() => void)[], scroll: [] as ((e: { scrollTopChanged: boolean }) => void)[] }
  const editor = {
    getValue: () => value,
    getVisibleRanges: () => [{ startLineNumber: 1 }],
    onDidChangeModelContent: (cb: () => void) => void handlers.content.push(cb),
    onDidChangeModel: (cb: () => void) => void handlers.model.push(cb),
    onDidScrollChange: (cb: (e: { scrollTopChanged: boolean }) => void) => void handlers.scroll.push(cb),
  } as unknown as EditorInstance
  return {
    editor,
    edit: (next: string) => { value = next; handlers.content.forEach(cb => cb()) },
    switchModel: (next: string) => { value = next; handlers.model.forEach(cb => cb()) },
    scroll: () => handlers.scroll.forEach(cb => cb({ scrollTopChanged: true })),
  }
}

const body = (): string => document.getElementById('vizPanelBody')?.textContent ?? ''
const panel = (): HTMLElement => document.getElementById('vizPanel') as HTMLElement
const toggle = (): HTMLElement => document.getElementById('panelToggleViz') as HTMLElement

describe('initIndentVizPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    mountDom()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('起動時に現在の内容を描画する', () => {
    initIndentVizPanel(createFakeEditor('def f():\n    pass').editor, () => 'main.py')
    expect(body()).toContain('def f():')
  })

  it('内容変更はデバウンスしてから反映する', () => {
    const fake = createFakeEditor('x = 1')
    initIndentVizPanel(fake.editor, () => 'main.py')
    fake.edit('y = 2')
    fake.edit('z = 3')
    expect(body()).toContain('x = 1')
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS - 1)
    expect(body()).toContain('x = 1')
    vi.advanceTimersByTime(1)
    expect(body()).toContain('z = 3')
    expect(body()).not.toContain('y = 2')
  })

  it('ファイル切替（モデル差し替え）は即時に反映し、待機中の描画を取り消す', () => {
    const fake = createFakeEditor('x = 1')
    initIndentVizPanel(fake.editor, () => 'main.py')
    fake.edit('pending = 1')
    fake.switchModel('other = 1')
    expect(body()).toContain('other = 1')
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS)
    expect(body()).toContain('other = 1')
  })

  it('.py 以外のファイルでは案内を出す', () => {
    initIndentVizPanel(createFakeEditor('a,b\n1,2').editor, () => 'data.csv')
    expect(body()).toContain('.py')
    expect(body()).not.toContain('a,b')
  })

  it('コードが空なら案内を出す', () => {
    initIndentVizPanel(createFakeEditor('# comment only').editor, () => 'main.py')
    expect(body()).toContain('表示できるコードがありません')
  })

  it('極端に深い入れ子でも落ちずに案内を出す', () => {
    const deep = Array.from({ length: 6000 }, (_, i) => ' '.repeat(i) + 'if x:').join('\n')
    expect(() => initIndentVizPanel(createFakeEditor(deep).editor, () => 'main.py')).not.toThrow()
    expect(body().length).toBeGreaterThan(0)
  })

  it('閉じると描画を止め、状態を保存する。開き直すと最新を描画する', () => {
    const fake = createFakeEditor('x = 1')
    initIndentVizPanel(fake.editor, () => 'main.py')
    toggle().click()
    expect(panel().classList.contains('hidden')).toBe(true)
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(window.localStorage.getItem('narapy.indentViz.open')).toBe('false')

    fake.edit('closed_edit = 1')
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS)
    expect(body()).toContain('x = 1')

    toggle().click()
    expect(panel().classList.contains('flex')).toBe(true)
    expect(body()).toContain('closed_edit = 1')
  })

  it('保存済みの閉じた状態で起動すると描画しない', () => {
    window.localStorage.setItem('narapy.indentViz.open', 'false')
    initIndentVizPanel(createFakeEditor('x = 1').editor, () => 'main.py')
    expect(panel().classList.contains('hidden')).toBe(true)
    expect(body()).toBe('')
  })

  it('スクロールイベントは1フレームにまとめて処理する', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const fake = createFakeEditor('x = 1')
    initIndentVizPanel(fake.editor, () => 'main.py')
    fake.scroll()
    fake.scroll()
    fake.scroll()
    expect(raf).toHaveBeenCalledTimes(1)
    raf.mockRestore()
  })

  it('必要な要素がなければ何もしない', () => {
    document.body.innerHTML = ''
    expect(() => initIndentVizPanel(createFakeEditor('x = 1').editor, () => 'main.py')).not.toThrow()
  })
})
