# 向いている方向へ進みながら回り続ける（円を描く）オブジェクトスクリプト。
# 複数オブジェクトに別々の値で持たせると、それぞれ違う弧を描く。
from stage import on_start, on_update


@on_start
def start():
    self.goto(-80, 0)
    self.direction = 90


@on_update
def update(dt):
    self.move(3)   # 向いている方向へ進む
    self.turn(2)   # 少しずつ向きを変える
