// メインスレッドの Pyodide に注入する Python ソース。
// import・一時変数は関数内に閉じ込める（グローバルにユーザー変数と衝突する名前を残さない）。

// 停止要求のフラグ名。JS が立て、パッチ済みの関数が確認して KeyboardInterrupt を投げる
export const STOP_FLAG = '__narapy_pygame_stop__'

// 同期のゲームループ（`while True:` で await を書かない普通の書き方）を動かすためのパッチ。
// JSPI（Pyodide の run_sync）が使えるブラウザでは、描画・イベント取得・フレーム待ちのたびに
// ブラウザへ制御を返す。これで描画・キー入力・停止ボタン・ウォッチドッグの心拍が止まらない。
// can_run_sync() は呼び出しのたびに確認し、使えない場面では何もしない（元の関数と同じ挙動）。
const SYNC_PATCHES_CODE = `
def __narapy_install_sync_patches__():
    import asyncio, time, pygame
    from pyodide.ffi import can_run_sync, run_sync
    if getattr(pygame, '__narapy_sync_patched__', False):
        return
    pygame.__narapy_sync_patched__ = True
    state = {'last': time.monotonic()}

    # 停止ボタンが押されたら、ユーザーコードのスタック上で KeyboardInterrupt を投げる。
    # SIGINT（interrupt buffer）は yield 中だと Pyodide のイベントループ内部に当たって壊れるため使わない
    def check_stop():
        if __narapy_pygame_stop__:
            raise KeyboardInterrupt()

    # run_sync は 1 回ごとに数 ms かかるため、フレーム内で何度も呼ばれても 5ms に 1 回へ間引く。
    # force=True（Clock.tick / 明示的な待機）は必ず制御を返す。
    def yield_to_browser(force=False):
        check_stop()
        if not can_run_sync():
            return
        now = time.monotonic()
        if force or now - state['last'] >= 0.005:
            run_sync(asyncio.sleep(0))
            state['last'] = time.monotonic()
            check_stop()

    def wrap(module, name, before):
        original = getattr(module, name)
        def wrapped(*args, **kwargs):
            # イベント取得は先に制御を返し、ブラウザが溜めた入力を SDL に渡してから読む
            if before:
                yield_to_browser()
            result = original(*args, **kwargs)
            if not before:
                yield_to_browser()
            return result
        wrapped.__name__ = name
        wrapped.__doc__ = original.__doc__
        setattr(module, name, wrapped)

    real_poll = pygame.event.poll
    for name in ('flip', 'update'):
        wrap(pygame.display, name, False)
    for name in ('get', 'pump', 'poll'):
        wrap(pygame.event, name, True)

    # event.wait は元の実装だとイベントが来るまでブラウザを固めるため、ポーリングで置き換える
    def event_wait(timeout=0):
        deadline = time.monotonic() + timeout / 1000 if timeout else None
        while True:
            event = real_poll()
            if event.type != pygame.NOEVENT:
                return event
            if deadline is not None and time.monotonic() >= deadline:
                return event
            yield_to_browser(True)
    pygame.event.wait = event_wait

    def sleep_in_browser(seconds, original):
        check_stop()
        if can_run_sync():
            # 長い待機でも停止ボタンに反応できるよう、短く区切って停止フラグを確認する
            deadline = time.monotonic() + seconds
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                run_sync(asyncio.sleep(min(remaining, 0.05)))
                check_stop()
            state['last'] = time.monotonic()
        else:
            original(seconds)

    real_time_sleep = time.sleep
    time.sleep = lambda seconds: sleep_in_browser(seconds, real_time_sleep)

    for name in ('wait', 'delay'):
        original_wait = getattr(pygame.time, name)
        def make_wait(original):
            def wait(milliseconds):
                sleep_in_browser(milliseconds / 1000, lambda s: original(int(s * 1000)))
                return int(milliseconds)
            return wait
        setattr(pygame.time, name, make_wait(original_wait))

    # Clock は C 型で属性を差し替えられないため、tick だけ制御を返す委譲クラスで置き換える
    original_clock = pygame.time.Clock
    class Clock:
        def __init__(self):
            self._clock = original_clock()
        def tick(self, framerate=0):
            result = self._clock.tick(framerate)
            yield_to_browser(True)
            return result
        def tick_busy_loop(self, framerate=0):
            result = self._clock.tick_busy_loop(framerate)
            yield_to_browser(True)
            return result
        def __getattr__(self, name):
            return getattr(self._clock, name)
    pygame.time.Clock = Clock
    if hasattr(pygame, 'Clock'):
        pygame.Clock = Clock
`

export const BOOTSTRAP_CODE = `${SYNC_PATCHES_CODE}
__narapy_pygame_task__ = None
__narapy_pygame_stop__ = False

# 作業ディレクトリへ移動し、前回実行の直下モジュール（import helper 等）を sys.modules から外して
# 編集後の内容が再 import されるようにする
def __narapy_pygame_prepare__(workdir, names):
    import os, sys, importlib
    global __narapy_pygame_task__, __narapy_pygame_stop__
    __narapy_pygame_task__ = None
    __narapy_pygame_stop__ = False
    os.chdir(workdir)
    for name in names:
        sys.modules.pop(name, None)
    importlib.invalidate_caches()

# await で止まっている非同期ループ向けの停止。同期ループは停止フラグ（STOP_FLAG）で止まる
def __narapy_pygame_cancel__():
    if __narapy_pygame_task__ is not None:
        __narapy_pygame_task__.cancel()

# 例外・キャンセルのどちらでも pygame.quit() を実行して次回実行に状態を持ち越さない。
# ユーザーコードのファイル名は通常実行と同じ "<exec>" にする（エラー翻訳が行番号を
# File "<exec>", line N から抽出するため。別名だとこのラッパー内の行番号を拾ってしまう）
async def __narapy_pygame_main__(src):
    import ast, asyncio, sys, pygame, narapy_host
    global __narapy_pygame_task__
    __narapy_pygame_task__ = asyncio.current_task()
    # set_mode は canvas 要素のサイズを変えないため、返した Surface のサイズをホストへ通知する
    if not getattr(pygame.display.set_mode, '__narapy_wrapped__', False):
        orig_set_mode = pygame.display.set_mode
        def set_mode(*args, **kwargs):
            surface = orig_set_mode(*args, **kwargs)
            narapy_host.resize(*surface.get_size())
            return surface
        set_mode.__narapy_wrapped__ = True
        pygame.display.set_mode = set_mode
    if not getattr(pygame.display.set_caption, '__narapy_wrapped__', False):
        orig_set_caption = pygame.display.set_caption
        def set_caption(*args, **kwargs):
            orig_set_caption(*args, **kwargs)
            narapy_host.caption(pygame.display.get_caption()[0])
        set_caption.__narapy_wrapped__ = True
        pygame.display.set_caption = set_caption
    __narapy_install_sync_patches__()
    ns = {'__name__': '__main__'}
    try:
        res = eval(compile(src, '<exec>', 'exec', ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), ns)
        if res is not None:
            await res
    finally:
        pg = sys.modules.get('pygame')
        if pg is not None:
            pg.quit()
`

// JSPI（run_sync）が使えるかの判定。runPythonAsync 経由の呼び出し経路で確認する必要がある
export const CAN_RUN_SYNC_CODE = 'from pyodide.ffi import can_run_sync\ncan_run_sync()'

// 実行の開始。runPythonAsync 経由にすることで、同期コード全体が JSPI の suspend 可能な
// スタック上で走る（ensure_future した Task の中では run_sync が使えない）
export const RUN_MAIN_CODE = 'await __narapy_pygame_main__(__narapy_pygame_src__)'

export const CANCEL_CODE = '__narapy_pygame_cancel__()'
