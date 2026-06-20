/// <reference lib="webworker" />

// Pythonライブステージ PoC の Web Worker。
// pyodide.worker.ts を簡略移植したもの（matplotlib/turtle/input は持ち込まない）。
//
// 実行モデル:
//   1. ユーザーコードを1回だけ実行（Sprite 生成・@on_start/@on_update 登録）
//   2. @on_start を実行
//   3. @on_update があれば、約60fps でフレームループを回す
//      毎フレーム: _tick(dt) → _dump_scene() を JSON 化 → メインスレッドへ post
//   4. stop メッセージ or 例外でループ終了

import { PYODIDE_CDN, PYODIDE_MJS_HASH, verifiedImport } from '../lib/pyodideLoader'
import { STAGE_MODULE_SRC } from '../pyodide/stageModule'
import type { StageInMessage, StageOutMessage, StageScene, RunObject } from './types'

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  globals: {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
  }
}

interface PyodideModule {
  loadPyodide: (options: {
    indexURL: string
    stdout?: (text: string) => void
    stderr?: (text: string) => void
  }) => Promise<PyodideInterface>
}

const FRAME_INTERVAL_MS = 16 // 約60fps

// stage モジュールを毎回フレッシュに sys.modules['stage'] へ登録する。
const REGISTER_STAGE_CODE = `
import sys as _sys, types as _types
_m = _types.ModuleType('stage')
exec(__stage_src__, _m.__dict__)
_sys.modules['stage'] = _m
del _m
`

// 1つのゲームオブジェクトのスクリプトを専用名前空間で実行（self 注入）。
const LOAD_OBJECT_CODE = `
import sys as _sys
_sys.modules['stage']._load_object(__obj_name__, __obj_script__)
`

// 全オブジェクト読み込み後に @on_start を呼ぶ。
const RUN_START_CODE = `
import sys as _sys, json as _json
_stage = _sys.modules['stage']
_stage._run_start()
_json.dumps(_stage._dump_scene())
`

// 1フレーム進めてシーンを JSON で返す。キー状態は毎フレーム丸ごと同期する。
const TICK_CODE = `
import sys as _sys, json as _json
_stage = _sys.modules['stage']
_stage._set_keys(__keys__)
_stage._tick(__dt__)
_json.dumps(_stage._dump_scene())
`

const HAS_UPDATE_CODE = `
import sys as _sys
_sys.modules['stage']._has_update()
`

function post(message: StageOutMessage): void {
  self.postMessage(message)
}

let pyodide: PyodideInterface | null = null
let isReady = false
let running = false
let stopRequested = false

// 現在押されているキー名の集合。'key' メッセージで更新し、毎フレーム Python へ渡す。
const keyState = new Set<string>()

async function initPyodide(): Promise<void> {
  const { loadPyodide } = (await verifiedImport(
    `${PYODIDE_CDN}pyodide.mjs`,
    PYODIDE_MJS_HASH,
  )) as PyodideModule

  pyodide = await loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (text: string) => post({ type: 'stdout', payload: text }),
    stderr: (text: string) => post({ type: 'error', payload: text }),
  })

  isReady = true
  post({ type: 'ready' })
}

const initPromise = initPyodide()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 約60fps でフレームループを回す。stopRequested で終了。
async function runFrameLoop(): Promise<void> {
  if (!pyodide) return
  let last = Date.now()

  while (!stopRequested) {
    const now = Date.now()
    const dt = (now - last) / 1000
    last = now

    pyodide.globals.set('__dt__', dt)
    pyodide.globals.set('__keys__', [...keyState])
    const sceneJson = (await pyodide.runPythonAsync(TICK_CODE)) as string
    post({ type: 'frame', scene: JSON.parse(sceneJson) as StageScene })

    await sleep(FRAME_INTERVAL_MS)
  }
}

async function run(objects: RunObject[]): Promise<void> {
  if (!pyodide || !isReady) {
    post({ type: 'error', payload: 'Pyodide の初期化が完了していません' })
    return
  }
  if (running) return
  running = true
  stopRequested = false

  try {
    // stage モジュールを毎回フレッシュ登録（状態リセット）
    pyodide.globals.set('__stage_src__', STAGE_MODULE_SRC)
    await pyodide.runPythonAsync(REGISTER_STAGE_CODE)

    // 各ゲームオブジェクトのスクリプトを self 注入付きで読み込む
    for (const obj of objects) {
      pyodide.globals.set('__obj_name__', obj.name)
      pyodide.globals.set('__obj_script__', obj.script)
      try {
        await pyodide.runPythonAsync(LOAD_OBJECT_CODE)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        post({ type: 'error', payload: `[${obj.name}] ${message}` })
        return
      }
    }

    // @on_start を実行し、初期シーンを描画
    const startJson = (await pyodide.runPythonAsync(RUN_START_CODE)) as string
    post({ type: 'frame', scene: JSON.parse(startJson) as StageScene })

    // @on_update があればフレームループ開始
    const hasUpdate = (await pyodide.runPythonAsync(HAS_UPDATE_CODE)) as boolean
    if (hasUpdate) {
      await runFrameLoop()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    post({ type: 'error', payload: message })
  } finally {
    running = false
    post({ type: 'stopped' })
  }
}

function setKey(name: string, down: boolean): void {
  const key = name.toLowerCase()
  if (down) {
    keyState.add(key)
  } else {
    keyState.delete(key)
  }
}

self.onmessage = (event: MessageEvent<StageInMessage>) => {
  const msg = event.data
  if (msg.type === 'run') {
    void initPromise.then(() => run(msg.objects))
  } else if (msg.type === 'stop') {
    stopRequested = true
  } else if (msg.type === 'key') {
    setKey(msg.name, msg.down)
  }
}
