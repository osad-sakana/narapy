export type ActiveSource = 'blockly' | 'editor'

export function shouldConvert(isBlocklyPanelHidden: boolean): boolean {
  return !isBlocklyPanelHidden
}

export function shouldResyncOnReveal(isBlocklyPanelHidden: boolean, activeSource: ActiveSource): boolean {
  return !isBlocklyPanelHidden && activeSource === 'editor'
}
