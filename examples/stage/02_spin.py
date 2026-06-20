# 毎フレーム回転し続けるオブジェクトスクリプト。フレームループの確認用。
from stage import on_start, on_update


@on_start
def start():
    self.size = 200


@on_update
def update(dt):
    self.turn(3)  # 反時計回りに3度/フレーム
