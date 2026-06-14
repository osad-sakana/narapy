# Turtle 描画 リファレンス（教材作成者向け）

Narapy に組み込まれた **turtle 互換モジュール** の仕様まとめです。授業で使う教材コードを
作る際の「どこまで動くか・どう表示されるか・何に気をつけるか」をまとめています。

標準 Python の `turtle` は Tkinter 依存でブラウザでは動かないため、Narapy では Canvas 上に
描く独自実装を提供しています。**標準どおり `import turtle` で使えます**が、対応している
機能は授業用途に絞った範囲です。本書の「対応API」と「未対応」を確認してください。

---

## 1. 基本的な使い方

```python
import turtle

for _ in range(4):
    turtle.forward(100)
    turtle.right(90)
```

実行すると **描画モーダル**が開き、描いた図形がアニメーション表示されます。
モジュール関数（`turtle.forward(...)`）でも、`Turtle` インスタンス（後述）でも書けます。

---

## 2. 座標系

- **原点 (0, 0) は画面の中央**
- **X 軸は右が +、Y 軸は上が +**（数学と同じ。標準 turtle と同じ）
- タートルの**初期の向きは右（東＝0度）**
- 角度は**度数法**。`left()` は反時計回り、`right()` は時計回り

---

## 3. 対応API（MVP）

授業で使う最小限の関数のみ実装しています。`turtle.xxx()` の形でも、`Turtle` インスタンスの
メソッドとしても呼べます。括弧内は**別名（エイリアス）**です。

### 移動・向き

| 関数 | 別名 | 説明 |
| --- | --- | --- |
| `forward(d)` | `fd` | 向いている方向へ `d` 進む（線を引く） |
| `backward(d)` | `bk`, `back` | 後ろへ `d` 下がる |
| `left(a)` | `lt` | 左に `a` 度回る |
| `right(a)` | `rt` | 右に `a` 度回る |
| `goto(x, y)` | `setpos`, `setposition` | 座標 `(x, y)` へ移動（ペンが下りていれば線を引く） |

### ペン

| 関数 | 別名 | 説明 |
| --- | --- | --- |
| `penup()` | `pu` | ペンを上げる（移動しても線を引かない） |
| `pendown()` | `pd` | ペンを下ろす（線を引く） |
| `color(c)` | `pencolor` | ペンの色を変える（後述） |
| `pensize(n)` | `width` | 線の太さを変える |

### 表示・状態

| 関数 | 別名 | 説明 |
| --- | --- | --- |
| `hideturtle()` | `ht` | タートル（三角マーカー）を隠す |
| `showturtle()` | `st` | タートルを表示する |
| `speed(n)` | — | **何もしません**（後述）。引数は受け取るが無視 |
| `clear()` | — | 描いた線を全部消す（位置・向きは保持） |
| `reset()` | — | 線を消してタートルを初期状態へ戻す |

### Turtle クラス

```python
import turtle

t = turtle.Turtle()      # Pen / RawTurtle も同じ
t.color("red")
t.pensize(3)
for _ in range(3):
    t.forward(120)
    t.left(120)
```

上記の関数は `Turtle` のメソッドとしても用意されています。

> ⚠️ **重要な制限**: `Turtle` のインスタンスは**すべて 1 つの共通の状態を共有**します。
> `a = turtle.Turtle()` と `b = turtle.Turtle()` を作っても、別々のタートルにはならず
> 同じ 1 匹を動かすことになります。**複数タートルの同時制御は未対応**です。

---

## 4. 色の指定

`color()` / `pencolor()` / `bgcolor()` は次の形に対応しています。

```python
turtle.color("red")              # 色名（CSS の色名）
turtle.color("#ff8800")          # 16進
turtle.color((1.0, 0.5, 0.0))    # (r, g, b) タプル
turtle.color(1.0, 0.5, 0.0)      # r, g, b を個別に
```

### colormode（RGB の範囲）

- 既定は **`colormode(1.0)`**：各成分は **0.0〜1.0**
- **`colormode(255)`** にすると **0〜255** で指定できます

```python
import turtle, colorsys

turtle.colormode(1.0)
turtle.pencolor(colorsys.hsv_to_rgb(0.3, 1, 1))   # HSV→RGB(0〜1) をそのまま渡せる
```

`colorsys`（Python 標準ライブラリ）はそのまま使えます。虹色グラデーションなどに便利です。

> `color(pen, fill)` のように 2 つ渡した場合、**塗り（fill）は未対応**のため先頭のペン色のみ採用します。

---

## 5. 画面（Screen）まわり

ネット上の turtle サンプルをそのまま動かせるよう、画面制御系の関数・メソッドを
**互換スタブ**として用意しています（背景色以外は実質的に何もしません）。

```python
screen = turtle.Screen()
screen.setup(800, 800)          # サイズ指定は無視（Canvas は固定）
screen.bgcolor("black")         # ← 背景色は反映される
screen.title("My Drawing")      # 無視
screen.mainloop()               # 無視（プログラムはそのまま終了）
```

| 関数/メソッド | 挙動 |
| --- | --- |
| `Screen()` / `getscreen()` | スクリーンオブジェクトを返す |
| `bgcolor(c)` | **背景色を設定（反映される）** |
| `setup`, `title`, `tracer`, `update`, `listen` | 受け付けるが何もしない |
| `mainloop`, `done`, `bye`, `exitonclick` | 受け付けるが何もしない |
| `colormode(n)` | RGB の範囲を設定（[色の指定](#4-色の指定)参照） |

> `mainloop()` は標準 turtle では画面を開いたまま待機しますが、Narapy では**何もせず即座に終了**
> します（描画はプログラム終了後にまとめて表示されるため）。サンプルに含まれていても問題ありません。

---

## 6. 表示モーダルの挙動

プログラムを実行すると、描画結果がモーダルでアニメーション表示されます。

### 再生コントロール

| ボタン | 動作 |
| --- | --- |
| ▶ 通常再生 | 約 4 秒で最初から再生 |
| ⏩ 高速再生 | 約 1.2 秒で再生 |
| ⏭ ステップ | 線を 1 本ずつ進める |
| ⏸ 一時停止 | 再生を止める |
| ↺ 最初から | 描く前の状態に戻す |
| 🗺 全体表示 / 🎯 タートル追従 | 表示モードの切り替え |

- モーダルを開くと**自動で通常再生**が始まります。
- 進捗は右側に `描画済み / 全体 本` で表示されます。

### 表示モード

- **タートル追従（既定）**: 等倍のまま、タートルを画面中央に保って画面がスクロールします。
  大きな図形を細部まで追いたいときに向きます。
- **全体表示**: 図形全体が収まるように自動で縮小し、中央寄せします。

### 背景と方眼

- `bgcolor()` で背景色を指定するとその色で塗りつぶします。
- **背景色を指定しない場合は 50px（turtle 座標 50 単位）の方眼**を表示します。
  原点 (0, 0) を通る縦横の中央軸は少し濃く描かれます。

### `speed()` について

`speed()` は **何もしません**。標準 turtle では描画速度を変えますが、Narapy では
描画の動き（速さ）は**モーダルの再生ボタンで制御**します。教材では `speed(0)` を
書いても書かなくても結果は同じです。

---

## 7. 未対応の機能（スコープ外）

以下は**実装していません**。教材を作る際は避けてください。

- 塗りつぶし：`begin_fill()` / `end_fill()` / `fillcolor()`
- 円・点・文字：`circle()` / `dot()` / `stamp()` / `write()`
- 向きの直接指定や座標取得：`setheading()` / `seth()` / `xcor()` / `ycor()` /
  `heading()` / `position()` / `towards()` / `distance()`
- 取り消し：`undo()`
- イベント：`onkey()` / `onclick()` / `ontimer()` などのキー・クリック操作
- 複数タートルの独立制御（[Turtle クラス](#turtle-クラス)の制限を参照）
- ステップごとのリアルタイム入力との連動（描画はプログラム終了後にまとめて表示）

> これらを使ったコードはエラーになる、または意図どおり動きません。

---

## 8. よくあるつまずき

### 正多角形で「曲がらない」

各頂点で曲がる角度は**外角**で、`360 / n`（＝ `180 − 内角`）です。
内角の**合計** `180 * (n - 2)` をそのまま使うと角度がずれて図形になりません。

```python
import turtle

n = 5
for _ in range(n):
    turtle.forward(100)
    turtle.right(360 / n)      # 外角。n=5 なら 72 度
```

### 引数に数値以外を渡した

`forward("abc")` のように数値でない値を渡すと、
**「forward() には数値を指定してください」**というエラーがログに表示されます。
教材では `forward(100)` のように数値（または数値の変数）を渡してください。

---

## 9. 動作確認用サンプル

そのまま実行できる教材サンプルです。

### 正方形

```python
import turtle

for _ in range(4):
    turtle.forward(100)
    turtle.right(90)
```

### 正多角形（外角で回る）

```python
import turtle

n = 6
for _ in range(n):
    turtle.forward(80)
    turtle.right(360 / n)
```

### 螺旋

```python
import turtle

for i in range(60):
    turtle.forward(i * 3)
    turtle.left(59)
```

### 虹色の螺旋（色・colormode）

```python
import turtle
import colorsys

turtle.width(2)
n = 360
for i in range(n):
    turtle.pencolor(colorsys.hsv_to_rgb(i / n, 1.0, 1.0))
    turtle.forward(i * 2)
    turtle.right(59)
```

### コッホ雪片（再帰・背景色）

```python
import turtle

def koch(t, order, size):
    if order == 0:
        t.forward(size)
    else:
        for angle in [60, -120, 60, 0]:
            koch(t, order - 1, size / 3)
            t.left(angle)

screen = turtle.Screen()
screen.bgcolor("black")

t = turtle.Turtle()
t.hideturtle()
t.color("cyan")
t.penup()
t.goto(-200, 115)
t.pendown()

for _ in range(3):
    koch(t, 4, 400)
    t.right(120)
```

---

## 10. 技術的な補足（仕組み）

- Python は **Pyodide（Web Worker）** 上で実行され、turtle の描画操作は
  **線分のリストとして記録**されます。
- プログラムが**終了した後**に、記録された線分をメインスレッドへ渡して Canvas に描画します。
  そのため、描画の途中でユーザー入力を受けて図を変える、といったリアルタイム連動はできません。
- 関連実装: `src/pyodide/turtleModule.ts`（Python 互換モジュール）、
  `src/runner/turtleRenderer.ts`（描画）、`src/runner/turtlePlayer.ts`（再生）、
  `src/runner/turtleModal.ts`（モーダル UI）。
