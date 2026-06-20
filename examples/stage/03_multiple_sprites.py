# 複数オブジェクトの作り方メモ:
#   右下の「＋ オブジェクトを追加」で増やし、各オブジェクトに別々のスクリプトを貼る。
#   それぞれの self はそのオブジェクト自身を指す。
#
# 下はその一例（壁の手前で向きを変えてウロウロする）。別オブジェクトに貼ると同時に動く。
from stage import on_start, on_update

HALF_W = 240


@on_start
def start():
    self.goto(0, 0)
    self.direction = 0
    self.size = 120


@on_update
def update(dt):
    self.move(3)
    if self.x > HALF_W - 20 or self.x < -HALF_W + 20:
        self.direction = (self.direction + 180) % 360
