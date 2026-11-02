// pygame（pygame-ce）の主な関数・クラスの日本語説明。キーは jedi の full_name（実測値）。
import type { JaDoc } from './jaDocs'

export const PYGAME_DOCS: Readonly<Record<string, JaDoc>> = {
  'pygame.base.init': { summary: 'pygame のすべてのモジュールを初期化します。最初に1回呼びます。' },
  'pygame.base.quit': { summary: 'pygame を終了して後片付けをします。プログラムの最後に呼びます。' },
  'pygame.display.set_mode': {
    summary: 'ゲーム画面（ウィンドウ）を作り、描画先の Surface を返します。',
    params: {
      size: '画面の大きさ（幅, 高さ）。例: (640, 480)',
      flags: '表示モードのオプション（省略可）',
      depth: '色のビット数（省略可）',
      display: '表示するモニターの番号（省略可）',
      vsync: '垂直同期を使うか（省略可）',
    },
  },
  'pygame.display.set_caption': {
    summary: 'ウィンドウのタイトルを設定します。',
    params: { title: 'タイトルの文字列' },
  },
  'pygame.display.flip': { summary: '描いた内容を画面全体に反映します。毎フレームの最後に呼びます。' },
  'pygame.display.update': {
    summary: '描いた内容を画面に反映します。範囲を渡すとその部分だけ、省略すると画面全体を更新します。',
    params: { rectangle: '更新する範囲（省略可）' },
  },
  'pygame.event.get': {
    summary: '溜まっているイベント（キー入力・マウス操作・閉じるボタンなど）をまとめてリストで返します。',
    params: { eventtype: '取り出すイベントの種類（省略すると全部）' },
  },
  'pygame.event.pump': { summary: 'イベントを内部で処理し、ウィンドウが固まらないようにします。' },
  'pygame.event.poll': { summary: 'イベントを1つだけ取り出します。なければ NOEVENT を返します。' },
  'pygame.event.wait': { summary: '次のイベントが来るまで待ち、そのイベントを返します。' },
  'pygame.key.get_pressed': {
    summary: '今押されているキーの状態を返します。keys[pygame.K_LEFT] のように使います。',
  },
  'pygame.mouse.get_pos': { summary: 'マウスカーソルの位置（x, y）を返します。' },
  'pygame.mouse.get_pressed': { summary: 'マウスのボタンが押されているかを (左, 中, 右) の組で返します。' },
  'pygame.surface.Surface': {
    summary: '画像や描画先になる「紙」です。Surface((幅, 高さ)) で新しく作れます。',
    params: { size: '大きさ（幅, 高さ）', flags: 'オプション（省略可）', depth: '色のビット数（省略可）' },
  },
  'pygame.surface.Surface.fill': {
    summary: '全体、または一部の範囲を1色で塗りつぶします。',
    params: { color: '色。(255, 0, 0) のような (赤, 緑, 青)', rect: '塗る範囲（省略すると全体）', special_flags: '合成方法（省略可）' },
  },
  'pygame.surface.Surface.blit': {
    summary: '別の Surface（画像など）をこの Surface の指定位置に貼り付けて描きます。',
    params: { source: '貼り付ける画像', dest: '貼り付ける位置 (x, y)、または Rect', area: '画像の一部だけを使うときの範囲（省略可）', special_flags: '合成方法（省略可）' },
  },
  'pygame.surface.Surface.get_rect': { summary: 'この Surface と同じ大きさの Rect を返します。位置は x=0, y=0 から始まります。' },
  'pygame.surface.Surface.convert': { summary: '画面と同じ形式に変換して、描画を速くした Surface を返します。' },
  'pygame.surface.Surface.convert_alpha': { summary: '透明度を保ったまま画面向けに変換した Surface を返します。' },
  'pygame.rect.Rect': {
    summary: '四角形（x, y, 幅, 高さ）を表します。位置の管理や当たり判定に使います。',
    params: { left: '左端の x 座標', top: '上端の y 座標', width: '幅', height: '高さ' },
  },
  'pygame.draw.rect': {
    summary: '長方形を描きます。',
    params: { surface: '描き込む先の Surface', color: '色 (赤, 緑, 青)', rect: '範囲 (x, y, 幅, 高さ) または Rect', width: '線の太さ。0 なら塗りつぶし' },
  },
  'pygame.draw.circle': {
    summary: '円を描きます。',
    params: { surface: '描き込む先の Surface', color: '色 (赤, 緑, 青)', center: '中心の位置 (x, y)', radius: '半径', width: '線の太さ。0 なら塗りつぶし' },
  },
  'pygame.draw.line': {
    summary: '直線を描きます。',
    params: { surface: '描き込む先の Surface', color: '色 (赤, 緑, 青)', start_pos: '始点 (x, y)', end_pos: '終点 (x, y)', width: '線の太さ' },
  },
  'pygame.draw.ellipse': {
    summary: '楕円を描きます。',
    params: { surface: '描き込む先の Surface', color: '色 (赤, 緑, 青)', rect: '楕円が収まる長方形', width: '線の太さ。0 なら塗りつぶし' },
  },
  'pygame.draw.polygon': {
    summary: '多角形を描きます。',
    params: { surface: '描き込む先の Surface', color: '色 (赤, 緑, 青)', points: '頂点 (x, y) のリスト', width: '線の太さ。0 なら塗りつぶし' },
  },
  'pygame.time.Clock': { summary: '時間を測り、ゲームの速さ（フレームレート）をそろえるための時計です。' },
  'pygame.time.Clock.tick': {
    summary: '1秒あたりの更新回数が framerate を超えないよう待ちます。前回からの経過ミリ秒を返します。毎フレーム1回呼びます。',
    params: { framerate: '1秒あたりの更新回数の上限（FPS）。例: 60' },
  },
  'pygame.time.wait': { summary: '指定したミリ秒だけ処理を止めます。', params: { milliseconds: '待つ時間（ミリ秒）' } },
  'pygame.time.delay': { summary: '指定したミリ秒だけ処理を止めます。', params: { milliseconds: '待つ時間（ミリ秒）' } },
  'pygame.time.get_ticks': { summary: 'pygame.init() を呼んでからの経過時間をミリ秒で返します。' },
  'pygame.image.load': {
    summary: '画像ファイルを読み込んで Surface として返します。',
    params: { filename: '画像ファイルの名前' },
  },
  'pygame.transform.scale': {
    summary: '画像を指定した大きさに拡大・縮小した新しい Surface を返します。',
    params: { surface: '元の画像', size: '新しい大きさ（幅, 高さ）' },
  },
  'pygame.font.Font': {
    summary: 'フォント（文字の書体）を読み込みます。文字を画像にするときに使います。',
    params: { name: 'フォントファイルの名前。None なら標準のフォント', size: '文字の大きさ' },
  },
  'pygame.font.Font.render': {
    summary: '文字列を画像（Surface）にして返します。blit で画面に貼り付けます。',
    params: { text: '表示する文字列', antialias: '文字の縁をなめらかにするか（True 推奨）', color: '文字の色 (赤, 緑, 青)', bgcolor: '背景色（省略すると透明）' },
  },
  'pygame.font.SysFont': {
    summary: 'パソコンにあるフォントを名前で指定して読み込みます。',
    params: { name: 'フォントの名前', size: '文字の大きさ' },
  },
}
