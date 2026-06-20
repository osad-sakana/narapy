// Pyodide(Web Worker) 内で `import stage` を解決するための自作ステージモジュール。
// Scratch風のスプライト/ステージを「独自シンプルAPI」で提供する PoC 版。
//
// 設計の核心: ユーザーコードはハンドラ登録のみを行い、実ループは JS 側が回す。
//   - @on_start … 実行開始時に1回
//   - @on_update … 毎フレーム（JS が約60fpsで _tick(dt) を呼ぶ）
//   - key_pressed(name) … JS が _set_key() で更新したキー状態を同期参照
//
// 毎フレーム _dump_scene() で全スプライト状態を JSON 化し、メインスレッドの Canvas で描画する。
// この文字列は worker 側で types.ModuleType('stage') に exec され、run 毎にフレッシュ登録される
// （状態リセットを保証するため）。
//
// 座標系: 中央原点・Y軸上向き・0度=東、direction は反時計回りが正（数学の角度）。

export const STAGE_MODULE_SRC = `
import math as _math

# ステージ状態（モジュールロード時=実行開始時に初期化）
_background = 'black'
_sprites = []           # Sprite インスタンスの登録順リスト
_start_handlers = []    # @on_start で登録された関数
_update_handlers = []   # @on_update で登録された関数
_keys = set()           # 現在押されているキー名の集合

# ゲームオブジェクトへ順番に割り当てる色パレット
_PALETTE = ['#7c3aed', '#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#f87171']


class Sprite:
    """ステージ上のスプライト。PoC では矢印（向きが見える三角形）で描画される。"""

    def __init__(self, color='#7c3aed'):
        self.name = ''
        self.x = 0.0
        self.y = 0.0
        self.direction = 0.0   # 度。0=東、反時計回りが正
        self.size = 100.0      # %（100 = 等倍）
        self.color = color
        self.visible = True
        _sprites.append(self)

    def goto(self, x, y):
        """指定座標へ瞬間移動する。"""
        self.x = float(x)
        self.y = float(y)

    def move(self, steps):
        """現在の向きへ steps だけ進む。"""
        rad = _math.radians(self.direction)
        self.x += float(steps) * _math.cos(rad)
        self.y += float(steps) * _math.sin(rad)

    def turn(self, degrees):
        """向きを degrees 度回す（正の値で反時計回り）。"""
        self.direction = (self.direction + float(degrees)) % 360.0

    def hide(self):
        self.visible = False

    def show(self):
        self.visible = True


def on_start(func):
    """実行開始時に1回だけ呼ばれる関数を登録するデコレータ。"""
    _start_handlers.append(func)
    return func


def on_update(func):
    """毎フレーム呼ばれる関数を登録するデコレータ。引数 dt（秒）は任意。"""
    _update_handlers.append(func)
    return func


def key_pressed(name):
    """name のキーが今押されているかを返す（例: "right", "left", "up", "space"）。"""
    return str(name).lower() in _keys


def stage(background=None):
    """ステージ設定。今は背景色のみ。"""
    global _background
    if background is not None:
        _background = str(background)


# --- 以下は JS（Worker）から呼ぶ内部 API。ユーザーは使わない。 ---

def _set_keys(names):
    """現在押されているキー名の集合を JS から丸ごと置き換える。"""
    global _keys
    _keys = set(str(n).lower() for n in names)


def _call(func, dt):
    """ハンドラを呼ぶ。dt を受け取る関数にだけ dt を渡す（引数の有無で判定）。"""
    code = getattr(func, '__code__', None)
    if code is not None and code.co_argcount >= 1:
        func(dt)
    else:
        func()


def _load_object(name, script):
    """1つのゲームオブジェクトのスクリプトを専用名前空間で実行する。
    名前空間に self（そのオブジェクトのスプライト）を注入する。
    スクリプト内の @on_start / @on_update は self を閉包したまま共通リストへ登録される。"""
    sprite = Sprite(color=_PALETTE[len(_sprites) % len(_PALETTE)])
    sprite.name = str(name)
    namespace = {'self': sprite, '__name__': '__main__'}
    exec(script, namespace)
    return sprite


def _run_start():
    for _h in _start_handlers:
        _call(_h, 0.0)


def _tick(dt):
    for _h in _update_handlers:
        _call(_h, dt)


def _has_update():
    return len(_update_handlers) > 0


def _dump_scene():
    return {
        'background': _background,
        'sprites': [
            {
                'name': s.name,
                'x': s.x,
                'y': s.y,
                'direction': s.direction,
                'size': s.size,
                'color': s.color,
                'visible': bool(s.visible),
            }
            for s in _sprites
        ],
    }
`
