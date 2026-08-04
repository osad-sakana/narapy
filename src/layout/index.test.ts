import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveBlocklyCollapsed, BTN_ACTIVE, BTN_INACTIVE } from './index'
import { RUN_STYLE, STOP_STYLE } from '../runner/buttonStyles'

describe('resolveBlocklyCollapsed', () => {
  it('Blockly有効時は保存された折りたたみ状態をそのまま使う', () => {
    expect(resolveBlocklyCollapsed(true, false)).toBe(false)
    expect(resolveBlocklyCollapsed(true, true)).toBe(true)
  })

  it('Blockly無効時はパネルが存在しないため常に折りたたみ扱いにする', () => {
    expect(resolveBlocklyCollapsed(false, false)).toBe(true)
    expect(resolveBlocklyCollapsed(false, true)).toBe(true)
  })
})

// ヘッダー幅が狭くなった際にラベルが潰れたり縦積みに折り返したりしないための回帰ガード。
// issue #51: shrink-0/whitespace-nowrapが欠けるとボタンが折り返してヘッダー高さが伸び、
// はみ出した#runBtnがoverflow-hiddenのbodyにクリップされ操作不能になる。
describe('ヘッダーの潰れ・折り返し防止クラス', () => {
  it('BTN_ACTIVE の全パネルトグルが whitespace-nowrap と shrink-0 を含む', () => {
    for (const className of Object.values(BTN_ACTIVE)) {
      expect(className).toContain('whitespace-nowrap')
      expect(className).toContain('shrink-0')
    }
  })

  it('BTN_INACTIVE が whitespace-nowrap と shrink-0 を含む', () => {
    expect(BTN_INACTIVE).toContain('whitespace-nowrap')
    expect(BTN_INACTIVE).toContain('shrink-0')
  })

  it('RUN_STYLE / STOP_STYLE が whitespace-nowrap と shrink-0 を含む', () => {
    expect(RUN_STYLE).toContain('whitespace-nowrap')
    expect(RUN_STYLE).toContain('shrink-0')
    expect(STOP_STYLE).toContain('whitespace-nowrap')
    expect(STOP_STYLE).toContain('shrink-0')
  })
})

// より強いガード: index.html 側のclass属性がTS定数と1文字も違わず一致しているかを検査する。
// layout/index.ts と runner/index.ts はDOM操作時にこれらの定数でclassNameを丸ごと上書きするため、
// index.html の初期class（静的マークアップ）がTS定数とずれると、パネル切替や実行操作の
// たびに潰れ・折り返し防止が巻き戻ってしまう。
describe('index.html とヘッダークラス定数の整合性', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf-8')

  function extractClass(id: string): string {
    const match = html.match(new RegExp(`id="${id}"[\\s\\S]*?class="([^"]*)"`))
    if (!match) throw new Error(`index.html に id="${id}" の要素が見つかりません`)
    return match[1]
  }

  it('#runBtn の class が RUN_STYLE と完全一致する（実行前の初期状態）', () => {
    expect(extractClass('runBtn')).toBe(RUN_STYLE)
  })

  it('パネルトグル3個の class が BTN_ACTIVE のいずれかと完全一致する（初期状態は全パネル表示）', () => {
    const activeValues = Object.values(BTN_ACTIVE)
    expect(activeValues).toContain(extractClass('panelToggleBlockly'))
    expect(activeValues).toContain(extractClass('panelTogglePython'))
    expect(activeValues).toContain(extractClass('panelToggleLog'))
  })
})
