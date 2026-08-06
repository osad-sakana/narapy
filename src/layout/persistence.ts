export const STORAGE_KEY = 'narapy-layout-v1'

export interface LayoutState {
  vertical: [number, number]
  editorCollapsed: boolean
  logCollapsed: boolean
}

export const DEFAULT_STATE: LayoutState = {
  vertical: [60, 40],
  editorCollapsed: false,
  logCollapsed: false,
}

export function load(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<LayoutState>) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function save(patch: Partial<LayoutState>): void {
  const { vertical, editorCollapsed, logCollapsed } = { ...load(), ...patch }
  // LayoutState に必須フィールドを追加した際、このオブジェクトリテラルを更新し忘れると
  // コンパイルエラーで検知できるようにする（スプレッドで組み立てると missing/excess
  // property チェックが効かず、旧キーが実行時に復活するバグが再発してしまう）
  const next: LayoutState = { vertical, editorCollapsed, logCollapsed }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
