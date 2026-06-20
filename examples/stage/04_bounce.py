# 壁で跳ね返るサンプル。ステージは 480x360（中央原点なので端は ±240 / ±180）。
# 速度を状態として持ち、端に達したら符号を反転する。
from stage import Sprite, on_start, on_update, stage

stage(background="#0d0820")

ball = Sprite(color="#f87171")
ball.size = 120

# 速度（イミュータブルに扱うため毎フレーム新しい値へ更新する）
state = {"vx": 5.0, "vy": 3.5}

HALF_W = 240
HALF_H = 180


@on_start
def setup():
    ball.goto(0, 0)


@on_update
def loop(dt):
    vx = state["vx"]
    vy = state["vy"]

    nx = ball.x + vx
    ny = ball.y + vy

    if nx > HALF_W or nx < -HALF_W:
        vx = -vx
        nx = ball.x + vx
    if ny > HALF_H or ny < -HALF_H:
        vy = -vy
        ny = ball.y + vy

    ball.goto(nx, ny)
    ball.direction = 0 if vx >= 0 else 180  # 進行方向へ矢印を向ける

    state["vx"] = vx
    state["vy"] = vy
