# 複数スプライトを同時に動かすサンプル。
# それぞれ向きと速度が違う矢印が円弧を描くように進む。
from stage import Sprite, on_start, on_update, stage

stage(background="#08131f")

# 色・初期位置・回転速度の異なる3体を生成
sprites = [
    Sprite(color="#f472b6"),
    Sprite(color="#a3e635"),
    Sprite(color="#fbbf24"),
]
turn_speeds = [2, -3, 4]


@on_start
def setup():
    for i, s in enumerate(sprites):
        s.goto(-120 + i * 120, 0)
        s.direction = 90
        s.size = 120


@on_update
def loop(dt):
    for s, turn_speed in zip(sprites, turn_speeds):
        s.move(3)        # 向いている方向へ進む
        s.turn(turn_speed)
