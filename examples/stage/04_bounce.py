# 壁で跳ね返るオブジェクトスクリプト。
# ステージは 480x360（中央原点なので端は ±240 / ±180）。
# 速度を self の属性として持たせ、端に達したら符号を反転する。
from stage import on_start, on_update

HALF_W = 240
HALF_H = 180


@on_start
def start():
    self.goto(0, 0)
    self.size = 120
    self.vx = 5.0   # 任意の属性を self に持たせられる
    self.vy = 3.5


@on_update
def update(dt):
    self.x += self.vx
    self.y += self.vy

    if self.x > HALF_W or self.x < -HALF_W:
        self.vx = -self.vx
    if self.y > HALF_H or self.y < -HALF_H:
        self.vy = -self.vy

    self.direction = 0 if self.vx >= 0 else 180
