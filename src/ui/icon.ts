// FontAwesome（自前バンドルの solid）のアイコン要素を DOM として組み立てる。
// innerHTML に文字列を流し込まないため、テキストと混ぜても XSS の経路にならない。

export function createIcon(name: string): HTMLElement {
  const icon = document.createElement('i')
  icon.className = `fa-solid fa-${name}`
  icon.setAttribute('aria-hidden', 'true')
  return icon
}

/** 子要素を「アイコン + テキスト」に置き換える。アイコンだけにしたいときは text を省略する */
export function setIconLabel(el: HTMLElement, iconName: string, text?: string): void {
  const nodes: Node[] = [createIcon(iconName)]
  if (text) nodes.push(document.createTextNode(text))
  el.replaceChildren(...nodes)
}
