# 毎フレーム回転し続けるサンプル。フレームループとturn()の確認用。
from stage import Sprite, on_update, stage

stage(background="black")

arrow = Sprite(color="#22d3ee")
arrow.size = 200


@on_update
def loop(dt):
    arrow.turn(3)  # 反時計回りに3度/フレーム
