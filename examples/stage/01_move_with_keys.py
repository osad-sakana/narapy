# 矢印キーで自分(self)を動かすオブジェクトスクリプト。
# self = このオブジェクトのスプライト。実行後ステージにフォーカスして矢印キーを押す。
from stage import on_start, on_update, key_pressed


@on_start
def start():
    self.goto(0, 0)
    self.direction = 90  # 上向き
    self.size = 140


@on_update
def update(dt):
    speed = 4
    if key_pressed("right"):
        self.x += speed
    if key_pressed("left"):
        self.x -= speed
    if key_pressed("up"):
        self.y += speed
    if key_pressed("down"):
        self.y -= speed
