import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { BTN_ACTIVE, HEADER_BTN_STYLES } from './index'
import { RUN_STYLE, STOP_STYLE } from '../runner/buttonStyles'

// ヘッダー幅が狭くなった際にラベルが潰れたり縦積みに折り返したりしないための回帰ガード。
// issue #51: shrink-0/whitespace-nowrapが欠けるとボタンが折り返してヘッダー高さが伸び、
// はみ出した#runBtnがoverflow-hiddenのbodyにクリップされ操作不能になる。
describe('ヘッダーの潰れ・折り返し防止クラス', () => {
  // HEADER_BTN_STYLES はパネルトグルの ACTIVE/INACTIVE 全パターンを含む。
  // BTN_INACTIVE（パネルOFF時 = ユーザーが最も踏む状態）は index.html との
  // 完全一致テストでは間接的にすら守られない（初期状態は常にACTIVE側のため）
  // ので、ここで直接検査する。
  it('パネルトグルの全スタイルと RUN_STYLE / STOP_STYLE が whitespace-nowrap と shrink-0 を含む', () => {
    for (const className of [...HEADER_BTN_STYLES, RUN_STYLE, STOP_STYLE]) {
      expect(className).toContain('whitespace-nowrap')
      expect(className).toContain('shrink-0')
    }
  })
})

// より強いガード: index.html 側のclass属性がTS定数と1文字も違わず一致しているかを検査する。
// layout/index.ts と runner/index.ts はDOM操作時にこれらの定数でclassNameを丸ごと上書きするため、
// index.html の初期class（静的マークアップ）がTS定数とずれると、パネル切替や実行操作の
// たびに潰れ・折り返し防止が巻き戻ってしまう。
describe('index.html とヘッダークラス定数の整合性', () => {
  // タグ抽出とclass抽出を2段階に分けることで、id/classの属性順に依存せず、
  // 「要素自体が見つからない」のか「要素はあるがclass属性がない」のかを
  // 区別できるようにする（属性値に">"を含むケースまでは対応不要）。
  function extractClass(id: string): string {
    const tag = indexHtml.match(new RegExp(`<[a-z][^>]*\\bid="${id}"[^>]*>`, 'i'))?.[0]
    if (!tag) throw new Error(`index.html に id="${id}" の要素が見つかりません`)
    const cls = tag.match(/\bclass="([^"]*)"/)?.[1]
    if (cls === undefined) throw new Error(`id="${id}" の要素に class 属性がありません`)
    return cls
  }

  it('#runBtn の class が RUN_STYLE と完全一致する（実行前の初期状態）', () => {
    expect(extractClass('runBtn')).toBe(RUN_STYLE)
  })

  it('パネルトグル2個の class が BTN_ACTIVE と完全一致する（初期状態は全パネル表示）', () => {
    expect(extractClass('panelTogglePython')).toBe(BTN_ACTIVE)
    expect(extractClass('panelToggleLog')).toBe(BTN_ACTIVE)
  })

  it('#editorHeader の class に opacity-50 が含まれない（Blockly廃止によりエディタ単独構成のため常時表示）', () => {
    expect(extractClass('editorHeader')).not.toContain('opacity-50')
  })
})

// Blockly廃止（issue #52）の回帰ガード: 関連id が index.html に復活していないことを検査する。
describe('Blockly関連idの非存在', () => {
  const blocklyIds = [
    'blocklyPanel',
    'blocklyDiv',
    'blocklyHeader',
    'blocklyOverlay',
    'blocklyUnsupportedBanner',
    'panelToggleBlockly',
    'validationBadge',
    'hintToggleBtn',
    'blocklyActiveDot',
    'editorActiveDot',
  ]

  it.each(blocklyIds)('id="%s" が存在しない', (id) => {
    expect(indexHtml).not.toMatch(new RegExp(`id="${id}"`))
  })
})
