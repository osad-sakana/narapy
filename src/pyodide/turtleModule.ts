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
_bg_color = None        # 背景色（bgcolor 未指定なら None＝白）
_colormode = 1.0        # 1.0=RGB 各成分 0..1、255=0..255（標準 turtle 既定は 1.0）
_segments = []          # {x1,y1,x2,y2,color,width} の配列（turtle 座標）


def _rgb_to_css(seq):
    """(r, g, b) を CSS の rgb(...) 文字列へ変換する。colormode に従う。"""
    scale = 255.0 / _colormode if _colormode else 1.0
    comps = []
    for v in seq[:3]:
        n = int(round(float(v) * scale))
        comps.append(max(0, min(255, n)))
    return 'rgb(%d,%d,%d)' % (comps[0], comps[1], comps[2])


def _color_value(args):
    """color()/pencolor() の引数（文字列・タプル・r,g,b）を CSS 色文字列にする。"""
    if len(args) >= 3:
        return _rgb_to_css(args)
    c = args[0]
    if isinstance(c, str):
        return c
    if isinstance(c, (tuple, list)):
        return _rgb_to_css(c)
    return str(c)


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


def color(*args):
    # color("red") / color((r,g,b)) / color(r, g, b) に対応。
    # 2 引数（pen, fill）形式は pen 色のみ採用する。
    global _pen_color
    if not args:
        return
    _pen_color = _color_value(args)


def pensize(n):
    global _pen_width
    _pen_width = _num(n, 'pensize')


def speed(n):
    # MVP では常に即時描画。速度指定は受け取るだけで無視する。
    if n is not None:
        _num(n, 'speed')


def hideturtle():
    global _visible
    _visible = False


def showturtle():
    global _visible
    _visible = True


def bgcolor(*args):
    global _bg_color
    if args:
        _bg_color = _color_value(args)


def clear():
    """描画線をすべて消す（タートルの位置・向きは保持）。"""
    _segments.clear()


def reset():
    """描画線を消し、タートルを初期状態に戻す。"""
    global _x, _y, _heading, _pen_down, _pen_color, _pen_width, _visible, _bg_color, _colormode
    _segments.clear()
    _x = 0.0
    _y = 0.0
    _heading = 0.0
    _pen_down = True
    _pen_color = 'black'
    _pen_width = 1.0
    _visible = True
    _bg_color = None
    _colormode = 1.0


# 画面・終了系（このプレビューでは画面制御が不要なため no-op）。
# 標準 turtle のコードを書き換えずに動かすためのスタブ。
def setup(*args, **kwargs):
    pass


def title(*args, **kwargs):
    pass


def mainloop(*args, **kwargs):
    pass


def done(*args, **kwargs):
    pass


def bye(*args, **kwargs):
    pass


def exitonclick(*args, **kwargs):
    pass


def tracer(*args, **kwargs):
    pass


def update(*args, **kwargs):
    pass


def colormode(mode=None, *args, **kwargs):
    global _colormode
    if mode is not None:
        _colormode = float(mode)
    return _colormode


class Screen:
    """turtle.Screen() 互換のスタブ。描画は専用 Canvas で行うため大半は no-op。"""

    def setup(self, *args, **kwargs):
        pass

    def bgcolor(self, c=None, *args, **kwargs):
        if c is not None:
            bgcolor(c)

    def title(self, *args, **kwargs):
        pass

    def tracer(self, *args, **kwargs):
        pass

    def update(self, *args, **kwargs):
        pass

    def colormode(self, *args, **kwargs):
        return colormode(*args, **kwargs)

    def mainloop(self, *args, **kwargs):
        pass

    def listen(self, *args, **kwargs):
        pass

    def exitonclick(self, *args, **kwargs):
        pass

    def bye(self, *args, **kwargs):
        pass


_screen = Screen()


def getscreen():
    return _screen


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
ht = hideturtle
st = showturtle


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

    def color(self, *args):
        color(*args)

    pencolor = color

    def pensize(self, n):
        pensize(n)

    width = pensize

    def speed(self, n):
        speed(n)

    def hideturtle(self):
        hideturtle()

    ht = hideturtle

    def showturtle(self):
        showturtle()

    st = showturtle

    def clear(self):
        clear()

    def reset(self):
        reset()

    def getscreen(self):
        return _screen


Pen = Turtle
RawTurtle = Turtle


def _dump_commands():
    """メインスレッドへ渡す描画データを返す（worker から呼ばれる内部 API）。"""
    return {
        'segments': list(_segments),
        'turtle': {'x': _x, 'y': _y, 'heading': _heading, 'visible': _visible},
        'background': _bg_color,
    }
`
