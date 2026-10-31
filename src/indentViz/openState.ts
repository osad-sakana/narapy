const STORAGE_KEY = 'narapy.indentViz.open'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/** パネルの開閉状態。保存がない・読めないときは「開く」（常時反映が既定） */
export function loadOpenState(storage: ReadableStorage | null): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export function saveOpenState(storage: WritableStorage | null, open: boolean): void {
  try {
    storage?.setItem(STORAGE_KEY, String(open))
  } catch {
    // プライベートモードなどで保存できなくても表示自体には影響させない
  }
}

/** localStorage へのアクセス自体が例外になる環境でも落ちないように取得する */
export function getLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
