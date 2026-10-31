import type * as monaco from 'monaco-editor'

const TOGGLE_COMMAND = 'toggleSuggestionDetails'
const TOGGLE_DELAY_MS = 50
const MAX_ATTEMPTS = 5

// 補完の詳細欄は Monaco 側では初期状態が閉じている。切り替えた状態は以降の候補表示にも引き継がれるので、
// 説明つきの候補が初めて表示されたときに一度だけ開く（その後に利用者が閉じたら閉じたままにする）。
// 開閉の公開 API は無いため、ウィジェットの DOM クラスを見て標準コマンドを実行している。
// editor.getDomNode() は表示中のノードと一致しないことがあり、そこを監視しても変化を拾えなかったため、
// document 全体を見る
export function openSuggestDetailsOnce(editor: monaco.editor.IStandaloneCodeEditor): monaco.IDisposable {
  let attempts = 0
  let scheduled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const visibleWidget = (): Element | null => document.querySelector('.suggest-widget.visible')

  // 候補の選択状態が整う前に切り替えても反映されないことがあるため、少し待ってから実行し、
  // 開いたか（shows-details）を次の変化で確かめる。開かなければ上限まで再試行する
  const toggle = (): void => {
    scheduled = false
    const widget = visibleWidget()
    if (!widget || widget.classList.contains('shows-details')) return
    editor.trigger('narapy', TOGGLE_COMMAND, {})
  }

  const observer = new MutationObserver(() => {
    const widget = visibleWidget()
    if (!widget) return
    if (widget.classList.contains('shows-details')) {
      // すでに開いている（利用者が開いた場合を含む）。以降は介入しない
      observer.disconnect()
      return
    }
    // 説明のない候補では開けないので、説明つきの候補に移るまで待つ
    if (!widget.querySelector('.can-expand-details')) return
    if (scheduled || attempts >= MAX_ATTEMPTS) return
    scheduled = true
    attempts += 1
    timer = setTimeout(toggle, TOGGLE_DELAY_MS)
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })

  return {
    dispose: () => {
      observer.disconnect()
      clearTimeout(timer)
    },
  }
}
