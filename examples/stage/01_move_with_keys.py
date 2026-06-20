# 矢印キーでスプライトを動かす基本サンプル。
# 実行後、ステージにフォーカスして矢印キーを押す。
from stage import Sprite, on_start, on_update, key_pressed, stage

stage(background="#0c1e30")

player = Sprite()
player.size = 140


@on_start
def setup():
    player.goto(0, 0)
    player.direction = 90  # 上向き


@on_update
def loop(dt):
    speed = 4
    if key_pressed("right"):
        player.x += speed
    if key_pressed("left"):
        player.x -= speed
    if key_pressed("up"):
        player.y += speed
    if key_pressed("down"):
        player.y -= speed
