import { PygameStalledError, startPygame, type PygameProject, type PygameSession } from './pygameRunner'
import { appendErrorBlock, appendLog } from '../runner/log'
import { translatePythonError } from '../runner/errorTranslator'

// ブラウザが同期ループ（JSPI）に対応しているかで、固まったときの直し方が変わる
function stallGuidance(syncLoop: boolean): string {
  return syncLoop
    ? 'ゲームのメインループの中で pygame.display.flip() / pygame.event.get() / Clock.tick() などを呼んでください。呼ばないループはブラウザが固まって止められません。'
    : 'このブラウザでは、ゲームのループ内で `await asyncio.sleep(0)` を呼ぶ必要があります（`async def main()` + `await main()` の形にします）。'
}

const INITIAL_SIZE = { width: 640, height: 480 }

export interface PygameModalHooks {
  // モーダルが開いている間はエディタを編集不可にするため、開閉を呼び出し側へ通知する
  onOpen: () => void
  onClose: () => void
}

// pygame をモーダル内の canvas で実行する。モーダルが全画面を覆い、開いている間は
// エディタを編集できない。閉じるボタンで実行を中断する（Esc はゲーム側のキー入力に使えるよう閉じる操作にしない）。
export function showPygameModal(code: string, project: PygameProject, hooks: PygameModalHooks): void {
  hooks.onOpen()

  const backdrop = document.createElement('div')
  backdrop.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')

  const card = document.createElement('div')
  card.className = 'bg-panel border border-line rounded-xl shadow-2xl overflow-hidden max-w-full flex flex-col'

  const header = document.createElement('div')
  header.className = 'flex items-center justify-between gap-4 px-4 py-2 border-b border-line'

  const titleEl = document.createElement('span')
  titleEl.className = 'text-ink text-sm font-medium'
  titleEl.textContent = '🎮 Pygame'

  const statusEl = document.createElement('span')
  statusEl.className = 'text-xs text-muted'
  statusEl.textContent = '読み込み中...'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-muted hover:text-ink text-sm font-bold transition-colors px-3 h-7 flex items-center justify-center rounded hover:bg-hover'
  closeBtn.textContent = '■ 停止して閉じる'

  const canvasContainer = document.createElement('div')
  canvasContainer.className = 'overflow-auto p-2 flex items-center justify-center bg-black'

  const canvas = document.createElement('canvas')
  canvas.width = INITIAL_SIZE.width
  canvas.height = INITIAL_SIZE.height
  canvas.className = 'max-w-full max-h-[75vh] outline-none'
  canvas.setAttribute('aria-label', 'pygame 描画')
  // キー入力を受けるにはフォーカスできる必要がある
  canvas.tabIndex = 0

  header.append(titleEl, statusEl, closeBtn)
  canvasContainer.appendChild(canvas)
  card.append(header, canvasContainer)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  // SDL は初期化時や set_caption で document.title を書き換えるため、モーダルの間は元のタイトルに戻し続ける
  const pageTitle = document.title
  const titleObserver = new MutationObserver(() => {
    if (document.title !== pageTitle) document.title = pageTitle
  })
  const titleNode = document.querySelector('title')
  if (titleNode) titleObserver.observe(titleNode, { childList: true, characterData: true, subtree: true })

  let session: PygameSession | null = null
  let closed = false

  const close = (): void => {
    if (closed) return
    closed = true
    session?.cancel()
    titleObserver.disconnect()
    document.title = pageTitle
    backdrop.remove()
    hooks.onClose()
  }

  closeBtn.addEventListener('click', close)

  void run()

  async function run(): Promise<void> {
    try {
      session = await startPygame(code, canvas, {
        onStdout: (text) => appendLog(text, 'output'),
        onCaption: (title) => {
          titleEl.textContent = `🎮 ${title}`
        },
        onResize: (width, height) => {
          canvas.width = width
          canvas.height = height
        },
        onLoading: (text) => {
          statusEl.textContent = text
          appendLog(text, 'info')
        },
      }, project)
      if (closed) {
        session.cancel()
        return
      }
      statusEl.textContent = '実行中'
      canvas.focus()
      await session.done
      if (!closed) statusEl.textContent = '終了しました'
    } catch (err) {
      if (err instanceof PygameStalledError) {
        appendLog(`--- ${err.message} ---`, 'warn')
        appendLog(stallGuidance(session?.syncLoop ?? false), 'info')
        close()
        return
      }
      const raw = err instanceof Error ? err.message : String(err)
      const translated = translatePythonError(raw)
      if (translated) {
        appendErrorBlock({ ...translated, raw })
      } else {
        appendLog(`[エラー] ${raw}`, 'error')
      }
      close()
    }
  }
}
