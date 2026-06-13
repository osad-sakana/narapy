// Pyodide(Web Worker) 内で `import turtle` を解決するための自作 turtle 互換モジュール。
// 標準 turtle は Tkinter 依存でブラウザでは動かないため、描画操作を turtle 座標
// （中央原点・Y軸上向き・0度=東）の線分リストとして記録するだけのモジュールを提供する。
// 実際の描画は実行後に _dump_commands() で抽出し、メインスレッドの Canvas で行う。
//
// この文字列は worker 側で types.ModuleType('turtle') に exec され、毎回フレッシュに
// sys.modules['turtle'] へ登録される（run 間の状態リセットを保証するため）。

export const TURTLE_MODULE_SRC = `
import math as _math

# 描画状態（モジュールロード時=実行開始時に初期化される）
_x = 0.0
_y = 0.0
_heading = 0.0          # 度数法。0=東（右）、反時計回りが正
_pen_down = True
_pen_color = 'black'
_pen_width = 1.0
_visible = True
_segments = []          # {x1,y1,x2,y2,color,width} の配列（turtle 座標）


def _num(value, func):
    """引数を float に変換する。失敗時はわかりやすい日本語エラーを送出。"""
    try:
        return float(value)
    except (TypeError, ValueError):
        raise TypeError(
            func + '() には数値を指定してください（受け取った値: ' + repr(value) + '）'
        )


def _move_to(nx, ny):
    global _x, _y
    if _pen_down:
        _segments.append({
            'x1': _x, 'y1': _y, 'x2': nx, 'y2': ny,
            'color': _pen_color, 'width': _pen_width,
        })
    _x, _y = nx, ny


def forward(distance):
    d = _num(distance, 'forward')
    rad = _math.radians(_heading)
    _move_to(_x + d * _math.cos(rad), _y + d * _math.sin(rad))


def backward(distance):
    forward(-_num(distance, 'backward'))


def left(angle):
    global _heading
    _heading = (_heading + _num(angle, 'left')) % 360


def right(angle):
    global _heading
    _heading = (_heading - _num(angle, 'right')) % 360


def goto(x, y):
    _move_to(_num(x, 'goto'), _num(y, 'goto'))


def penup():
    global _pen_down
    _pen_down = False


def pendown():
    global _pen_down
    _pen_down = True


def color(c):
    global _pen_color
    _pen_color = str(c)


def pensize(n):
    global _pen_width
    _pen_width = _num(n, 'pensize')


def speed(n):
    # MVP では常に即時描画。速度指定は受け取るだけで無視する。
    _num(n, 'speed')


def clear():
    """描画線をすべて消す（タートルの位置・向きは保持）。"""
    _segments.clear()


def reset():
    """描画線を消し、タートルを初期状態に戻す。"""
    global _x, _y, _heading, _pen_down, _pen_color, _pen_width, _visible
    _segments.clear()
    _x = 0.0
    _y = 0.0
    _heading = 0.0
    _pen_down = True
    _pen_color = 'black'
    _pen_width = 1.0
    _visible = True


# 別名（標準 turtle 互換）
fd = forward
bk = backward
back = backward
lt = left
rt = right
pu = penup
pd = pendown
pencolor = color
width = pensize
setpos = goto
setposition = goto


class Turtle:
    """グローバル状態を共有する薄いラッパー（t = turtle.Turtle() 形式の互換用）。"""

    def forward(self, distance):
        forward(distance)

    fd = forward

    def backward(self, distance):
        backward(distance)

    bk = backward
    back = backward

    def left(self, angle):
        left(angle)

    lt = left

    def right(self, angle):
        right(angle)

    rt = right

    def goto(self, x, y):
        goto(x, y)

    setpos = goto
    setposition = goto

    def penup(self):
        penup()

    pu = penup

    def pendown(self):
        pendown()

    pd = pendown

    def color(self, c):
        color(c)

    pencolor = color

    def pensize(self, n):
        pensize(n)

    width = pensize

    def speed(self, n):
        speed(n)

    def clear(self):
        clear()

    def reset(self):
        reset()


Pen = Turtle


def _dump_commands():
    """メインスレッドへ渡す描画データを返す（worker から呼ばれる内部 API）。"""
    return {
        'segments': list(_segments),
        'turtle': {'x': _x, 'y': _y, 'heading': _heading, 'visible': _visible},
    }
`
