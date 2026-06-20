// Pythonライブステージ PoC のエントリポイント。
// Monaco エディタ・Canvas ステージ・Worker を結線し、実行/停止とキーボード入力を扱う。

import { createEditor, getValue, setValue } from '../editor/index'
import { appendLog, appendErrorBlock, clearLog } from '../runner/log'
import { translatePythonError } from '../runner/errorTranslator'
import { renderScene } from './renderer'
import { STAGE_WIDTH, STAGE_HEIGHT } from './types'
import type { StageInMessage, StageOutMessage } from './types'

const SAMPLE_CODE = `from stage import Sprite, on_start, on_update, key_pressed, stage

stage(background="#0c1e30")

cat = Sprite()
cat.size = 140


@on_start
def setup():
    cat.goto(0, 0)
    cat.direction = 90


@on_update
def loop(dt):
    if key_pressed("right"):
        cat.x += 4
    if key_pressed("left"):
        cat.x -= 4
    if key_pressed("up"):
        cat.y += 4
    if key_pressed("down"):
        cat.y -= 4
    cat.turn(3)
`

// 物理キー → ステージのキー名。
function toKeyName(e: KeyboardEvent): string | null {
  switch (e.key) {
    case 'ArrowRight': return 'right'
    case 'ArrowLeft': return 'left'
    case 'ArrowUp': return 'up'
    case 'ArrowDown': return 'down'
    case ' ': return 'space'
    default:
      return e.key.length === 1 ? e.key.toLowerCase() : null
  }
}

function main(): void {
  const editor = createEditor(document.getElementById('codeEditor') as HTMLElement)
  setValue(editor, SAMPLE_CODE)

  const canvas = document.getElementById('stageCanvas') as HTMLCanvasElement
  canvas.width = STAGE_WIDTH
  canvas.height = STAGE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できません')

  const runBtn = document.getElementById('runBtn') as HTMLButtonElement
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement

  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

  let running = false

  function send(message: StageInMessage): void {
    worker.postMessage(message)
  }

  function setRunning(next: boolean): void {
    running = next
    runBtn.disabled = next
    stopBtn.disabled = !next
  }

  worker.onmessage = (event: MessageEvent<StageOutMessage>) => {
    const msg = event.data
    switch (msg.type) {
      case 'loading':
        appendLog(msg.payload, 'info')
        break
      case 'ready':
        appendLog('準備完了。実行できます。', 'info')
        runBtn.disabled = false
        break
      case 'stdout':
        appendLog(msg.payload.replace(/\n$/, ''), 'output')
        break
      case 'error': {
        const translated = translatePythonError(msg.payload)
        if (translated) {
          appendErrorBlock({ ...translated, raw: msg.payload })
        } else {
          appendLog(msg.payload, 'error')
        }
        break
      }
      case 'frame':
        renderScene(ctx, msg.scene)
        break
      case 'stopped':
        setRunning(false)
        break
    }
  }

  runBtn.addEventListener('click', () => {
    if (running) return
    clearLog()
    setRunning(true)
    send({ type: 'run', code: getValue(editor) })
  })

  stopBtn.addEventListener('click', () => {
    if (!running) return
    send({ type: 'stop' })
  })

  // キーボード入力は実行中のみ Worker へ送る。矢印・スペースの既定スクロールを抑止。
  window.addEventListener('keydown', (e) => {
    if (!running) return
    const name = toKeyName(e)
    if (!name) return
    if (['right', 'left', 'up', 'down', 'space'].includes(name)) e.preventDefault()
    send({ type: 'key', name, down: true })
  })
  window.addEventListener('keyup', (e) => {
    if (!running) return
    const name = toKeyName(e)
    if (!name) return
    send({ type: 'key', name, down: false })
  })

  // 初期状態: ready が来るまで実行不可。
  runBtn.disabled = true
  stopBtn.disabled = true
  appendLog('Pyodide を初期化中…', 'info')
}

main()
