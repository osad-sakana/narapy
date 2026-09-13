// 問題文(problem.md)をエディタ上部に常設表示するパネル(issue #65)。
// 当初はモーダル表示だったが、コードを見ながら問題文を参照したいという要望により
// エディタの上に開閉可能なパネルとして表示する形に変更した。
// #project=/?project=<URL> 経由で第三者が用意した .exercise を開ける仕様上、
// problem.md の中身は信頼できない入力として扱う必要がある。Markdownのレンダリング
// （innerHTML等）はここでは行わず、textContentでエスケープしたまま pre-wrap で
// 改行だけ保持して表示する（書式付き表示は将来課題）。
export interface ProblemPanel {
  // 演習読込時など、内容を表示して開く
  show: (problemText: string) => void
  hide: () => void
  toggle: () => void
}

export function createProblemPanel(panel: HTMLElement, body: HTMLElement): ProblemPanel {
  function setVisible(visible: boolean): void {
    panel.classList.toggle('hidden', !visible)
    panel.classList.toggle('flex', visible)
  }

  return {
    show: (problemText) => {
      body.textContent = problemText
      setVisible(true)
    },
    hide: () => setVisible(false),
    toggle: () => setVisible(panel.classList.contains('hidden')),
  }
}
