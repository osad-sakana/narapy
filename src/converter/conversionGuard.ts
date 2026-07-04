export type ActiveSource = 'blockly' | 'editor'

export function shouldConvert(isBlocklyPanelHidden: boolean): boolean {
  return !isBlocklyPanelHidden
}

export function shouldResyncOnReveal(isBlocklyPanelHidden: boolean, activeSource: ActiveSource): boolean {
  return !isBlocklyPanelHidden && activeSource === 'editor'
}

// Python編集中（ブロックを操作していない）に発生した変換エラーは、
// Pythonエディタ側の共有バッジを不必要に上書きしてしまうため表示しない
export function shouldReportConversionError(activeSource: ActiveSource): boolean {
  return activeSource === 'blockly'
}
