// Pythonライブステージ PoC の共有型。
// 座標は turtle 座標系（中央原点・Y軸上向き・0度=東）。ステージは固定 480x360。

export const STAGE_WIDTH = 480
export const STAGE_HEIGHT = 360

// ゲームオブジェクト。1オブジェクト = 1スクリプト。
export interface GameObject {
  id: string
  name: string
  script: string
}

// 1フレーム分のスプライト状態。stageModule(Python) が _dump_scene() で出力する。
export interface StageSprite {
  name: string
  x: number
  y: number
  direction: number // 度。0=東、反時計回りが正
  size: number // %（100 = 等倍）
  color: string
  visible: boolean
}

// 1フレーム分のシーン全体。
export interface StageScene {
  sprites: StageSprite[]
  background: string
}

// Worker → メインスレッドのメッセージ。
export type StageOutMessage =
  | { type: 'loading'; payload: string }
  | { type: 'ready' }
  | { type: 'stdout'; payload: string }
  | { type: 'error'; payload: string }
  | { type: 'frame'; scene: StageScene }
  | { type: 'stopped' }

// Worker へ送るゲームオブジェクト（id は不要なので name + script のみ）。
export interface RunObject {
  name: string
  script: string
}

// メインスレッド → Worker のメッセージ。
export type StageInMessage =
  | { type: 'run'; objects: RunObject[] }
  | { type: 'stop' }
  | { type: 'key'; name: string; down: boolean }
