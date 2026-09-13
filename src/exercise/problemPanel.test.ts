import { describe, expect, it } from 'vitest'
import { createProblemPanel } from './problemPanel'

// このプロジェクトのvitestはNode環境（jsdom未導入）で動くため、実DOMではなく
// createProblemPanelが実際に使うAPI（classList.toggle/contains, textContent）だけを
// 持つ最小限のfakeを用意する(controller.test.tsと同じ「DOM APIを直接使わずテストする」方針)。
function createFakeClassList(initial: string[] = []) {
  const classes = new Set(initial)
  return {
    toggle: (name: string, force?: boolean) => {
      const shouldAdd = force ?? !classes.has(name)
      if (shouldAdd) classes.add(name)
      else classes.delete(name)
    },
    contains: (name: string) => classes.has(name),
  }
}

function setup() {
  const panel = { classList: createFakeClassList(['hidden']) } as unknown as HTMLElement
  const body = { textContent: '' } as unknown as HTMLElement
  return { panel, body, problemPanel: createProblemPanel(panel, body) }
}

describe('createProblemPanel', () => {
  it('showで内容をセットしてパネルを表示する', () => {
    const { panel, body, problemPanel } = setup()

    problemPanel.show('# 足し算')

    expect(body.textContent).toBe('# 足し算')
    expect(panel.classList.contains('hidden')).toBe(false)
    expect(panel.classList.contains('flex')).toBe(true)
  })

  it('hideでパネルを隠す（内容は保持する）', () => {
    const { panel, body, problemPanel } = setup()

    problemPanel.show('# 足し算')
    problemPanel.hide()

    expect(panel.classList.contains('hidden')).toBe(true)
    expect(body.textContent).toBe('# 足し算')
  })

  it('toggleで表示⇄非表示を切り替える', () => {
    const { panel, problemPanel } = setup()

    problemPanel.show('問題文')
    expect(panel.classList.contains('hidden')).toBe(false)

    problemPanel.toggle()
    expect(panel.classList.contains('hidden')).toBe(true)

    problemPanel.toggle()
    expect(panel.classList.contains('hidden')).toBe(false)
  })

  it('problem.mdの内容はtextContentへの代入のみで挿入する(innerHTML化しない, XSS対策)', () => {
    const { body, problemPanel } = setup()

    problemPanel.show('<img src=x onerror=alert(1)>')

    expect(body.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})
