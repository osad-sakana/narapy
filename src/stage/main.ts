// Pythonライブステージ PoC のエントリポイント。
// ゲームオブジェクト一覧・選択中スクリプトのエディタ・コスチューム・Canvas ステージ・Worker を結線する。
// 1オブジェクト = 1スクリプト。スクリプトは暗黙の self（そのオブジェクト）を操作する。

import { createEditor, getValue, setValue } from '../editor/index'
import { appendLog, appendErrorBlock, clearLog } from '../runner/log'
import { translatePythonError } from '../runner/errorTranslator'
import { renderScene } from './renderer'
import { renderObjectList } from './objectList'
import { renderCostumePanel } from './costumePanel'
import { createCostumeCache } from './costumeCache'
import { fileToDataUrl } from './costume'
import {
  createObject,
  addObject,
  removeObject,
  updateScript,
  findObject,
  setCostume,
  removeCostume,
  updateCostume,
} from './objects'
import { STAGE_WIDTH, STAGE_HEIGHT } from './types'
import type { GameObject, StageScene, StageInMessage, StageOutMessage } from './types'

const PLAYER_SCRIPT = `from stage import on_start, on_update, key_pressed

@on_start
def start():
    self.goto(0, 0)
    self.size = 140


@on_update
def update(dt):
    if key_pressed("right"):
        self.x += 4
    if key_pressed("left"):
        self.x -= 4
    if key_pressed("up"):
        self.y += 4
    if key_pressed("down"):
        self.y -= 4
`

// 実行前プレビュー用の色パレット（stageModule._PALETTE と一致させる）。
const PREVIEW_PALETTE = ['#7c3aed', '#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#f87171']
const PREVIEW_SPACING = 90

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
  const objectListEl = document.getElementById('objectList') as HTMLElement
  const costumePanelEl = document.getElementById('costumePanel') as HTMLElement

  const canvas = document.getElementById('stageCanvas') as HTMLCanvasElement
  canvas.width = STAGE_WIDTH
  canvas.height = STAGE_HEIGHT
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) throw new Error('Canvas 2D コンテキストを取得できません')
  const ctx = ctx2d

  const runBtn = document.getElementById('runBtn') as HTMLButtonElement
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const costumes = createCostumeCache()

  // --- 状態（不変更新） ---
  let objects: GameObject[] = [createObject('player', PLAYER_SCRIPT)]
  let activeId: string = objects[0].id
  let running = false
  // プログラム的なエディタ書き込み中フラグ（オブジェクト切替時の変更通知を抑制）
  let isSyncingEditor = false

  function send(message: StageInMessage): void {
    worker.postMessage(message)
  }

  function activeObject(): GameObject | undefined {
    return findObject(objects, activeId)
  }

  // 実行していないときに、各オブジェクトを横一列へ並べたプレビューを描く。
  function buildPreviewScene(): StageScene {
    const n = objects.length
    return {
      background: '#000000',
      sprites: objects.map((o, i) => ({
        name: o.name,
        x: (i - (n - 1) / 2) * PREVIEW_SPACING,
        y: 0,
        direction: 0,
        size: 100,
        color: PREVIEW_PALETTE[i % PREVIEW_PALETTE.length],
        visible: true,
      })),
    }
  }

  function renderPreview(): void {
    if (running) return
    renderScene(ctx, buildPreviewScene(), costumes.get)
  }

  function refreshList(): void {
    renderObjectList(objectListEl, objects, activeId, {
      onSelect: selectObject,
      onAdd: addNewObject,
      onDelete: deleteObject,
    })
  }

  function refreshCostumePanel(): void {
    renderCostumePanel(costumePanelEl, activeObject(), {
      onLoad: loadCostume,
      onRemove: () => changeCostume((os) => removeCostume(os, activeId)),
      onToggle: (patch) => changeCostume((os) => updateCostume(os, activeId, patch)),
    })
  }

  function loadActiveIntoEditor(): void {
    const active = activeObject()
    isSyncingEditor = true
    setValue(editor, active ? active.script : '')
    isSyncingEditor = false
  }

  function selectObject(id: string): void {
    if (id === activeId) return
    activeId = id
    loadActiveIntoEditor()
    refreshList()
    refreshCostumePanel()
  }

  async function syncCostumesAndRender(): Promise<void> {
    await costumes.sync(objects)
    renderPreview()
  }

  function addNewObject(): void {
    objects = addObject(objects, 'object')
    activeId = objects[objects.length - 1].id
    loadActiveIntoEditor()
    refreshList()
    refreshCostumePanel()
    void syncCostumesAndRender()
  }

  function deleteObject(id: string): void {
    if (objects.length <= 1) return // 最低1つは残す
    objects = removeObject(objects, id)
    if (activeId === id) {
      activeId = objects[0].id
      loadActiveIntoEditor()
    }
    refreshList()
    refreshCostumePanel()
    void syncCostumesAndRender()
  }

  // コスチューム更新の共通処理: 状態更新 → キャッシュ同期 → 再描画。
  async function changeCostume(updater: (os: GameObject[]) => GameObject[]): Promise<void> {
    objects = updater(objects)
    await costumes.sync(objects)
    refreshList()
    refreshCostumePanel()
    renderPreview()
  }

  async function loadCostume(file: File): Promise<void> {
    try {
      const src = await fileToDataUrl(file)
      await changeCostume((os) => setCostume(os, activeId, src))
    } catch (err: unknown) {
      appendLog(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  // エディタ編集はアクティブオブジェクトのスクリプトへ反映
  editor.onDidChangeModelContent(() => {
    if (isSyncingEditor) return
    objects = updateScript(objects, activeId, getValue(editor))
  })

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
        renderScene(ctx, msg.scene, costumes.get)
        break
      case 'stopped':
        setRunning(false)
        renderPreview()
        break
    }
  }

  runBtn.addEventListener('click', () => {
    if (running) return
    clearLog()
    setRunning(true)
    send({
      type: 'run',
      objects: objects.map((o) => ({ name: o.name, script: o.script })),
    })
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

  // 初期表示
  loadActiveIntoEditor()
  refreshList()
  refreshCostumePanel()
  renderPreview()
  runBtn.disabled = true
  stopBtn.disabled = true
  appendLog('Pyodide を初期化中…', 'info')
}

main()
