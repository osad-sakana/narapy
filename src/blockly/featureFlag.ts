// Blocklyはデフォルトで無効。?blockly=1 が付いている場合のみ有効化する（issue #31）
export function isBlocklyEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('blockly') === '1'
}
