# Narapy — Claude Code ガイド

Python学習向けWebアプリのプロトタイプ。フロントエンド完結型アーキテクチャ（サーバー不要）。

## 技術スタック

| レイヤー       | 技術                                                                |
| -------------- | ------------------------------------------------------------------- |
| ビルド         | Vite 6 + TypeScript (Vanilla TS、フレームワークなし)                |
| スタイル       | Tailwind CSS v4（`@tailwindcss/vite` プラグイン、設定ファイル不要） |
| Python実行     | Pyodide v0.27（Web Worker経由）                                     |
| パッケージ管理 | **pnpm のみ**（npm / yarn 禁止）                                    |

## ディレクトリ構造

```
narapy/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts             # エントリポイント（各モジュール初期化・Worker通信）
│   ├── editor/             # Monaco エディタ・コード補完・フォントサイズ
│   ├── completion.worker.ts # Pyodide を使ったコード補完 Web Worker
│   ├── runner/             # 実行・Turtle/matplotlib 描画・エラー翻訳
│   ├── pyodide/            # Pyodide 連携（Turtle互換モジュール）
│   ├── pyodide.worker.ts   # Pyodide を動的 import で初期化する Web Worker
│   ├── lib/                # Pyodide ローダーなど共通ユーティリティ
│   ├── explorer/           # ファイルエクスプローラー・アップロード
│   ├── fileio/             # .narapy プロジェクト入出力
│   ├── urlload/            # URLの #code= / #project= / ?project=<URL> 読み込み
│   ├── makeUrl/            # /make-url（共有リンク生成ページ）のロジック
│   ├── layout/             # パネルレイアウト（split.js、状態をlocalStorageに永続化）
│   ├── about/              # ライセンス表示
│   ├── theme/              # カラーパレット・テーマ切り替え
│   └── style.css           # Tailwind v4 向けグローバルスタイル
├── index.html              # メイン画面（エディタ + ログ）
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 開発コマンド

```bash
# 開発サーバー起動
pnpm dev

# プロダクションビルド
pnpm build

# 型チェック
pnpm typecheck

# テスト実行
pnpm test
```

## アーキテクチャ上の重要事項

### COOP/COEP ヘッダー

`SharedArrayBuffer`（Pyodide に必要）のため `vite.config.ts` の `server.headers` に以下を設定済み。
S3/CloudFront デプロイ時も同様のヘッダーを付与すること。

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Pyodide Web Worker

`type: 'module'` の Worker では `importScripts()` が禁止。`/* @vite-ignore */` コメント付きの dynamic `import()` で CDN から読み込んでいる。

### ステップ実行トレース（src/pyodide/traceModule.ts, traceRun.ts, src/stepper/, src/trace/）

CPython 標準の `sys.settrace` を使い、実行を1回完走させながら全ステップ（行・変数）を
JSON に記録し、メインスレッド側でスクラブ再生する record-then-replay 方式。

- `sys.settrace()` はそれを呼び出した「現在のフレーム」自体はトレースしない
  （既にアクティブなフレームには局所トレース関数がインストールされないため）。そのため
  settrace の呼び出しと実際にトレースしたいコードの実行を必ず別フレーム（`exec()`）で行う。
- `co_filename` は `compile()` 時に指定したファイル名がそのまま使われる。ユーザーコードは
  仮想パス（`traceRun.ts` の `TRACE_FILENAME`）で compile し、'call' イベントでこのファイル名
  との**完全一致**を判定する（MVPでは単一ファイルのみ追跡。他ファイルはimportしても追跡対象外
  になり、誤って現在のファイルの行としてハイライトされることを防ぐ）。
- ステップ数の上限（800）に達すると `sys.settrace(None)` して残りを全速で完走させる
  （`while True:` などの無限ループでもブラウザが固まらないようにするため）。CPython 3.12の
  PEP 709（内包表記のインライン化）により、内包表記1行の反復ごとに'line'イベントが発生する
  ため、大きめの内包表記（`[x*x for x in range(10000)]`等）だけで上限を使い切り、以降の行が
  記録されないことがある（既知の制約。将来的に「同一行の連続反復を1ステップに畳む」等の対応
  が必要）。
- 停止操作（`gracefulStop`、KeyboardInterrupt 注入）は Worker を終了させないため、settrace が
  残ったまま次の実行に持ち込まれるおそれがある。Python 側の `finally` に加えて、
  `pyodide.worker.ts` の `onmessage` 冒頭で毎回 `sys.settrace(None)` を呼ぶ防御を入れている。
  これを削除しないこと（削除すると以降の通常実行が静かに数十倍遅くなる）。
- トレーサ内部（`_Recorder` 等）は `_narapy_trace` という独立モジュールとして
  `sys.modules` に登録し、`__main__`（`pyodide.globals`）を汚さない。一方ユーザーコードは
  `__main__` の `globals()` で `exec` する（`customInput` を差し込んだ `input` 等の既存の
  グローバル状態を保つため）。新しい namespace で exec しないこと。
- トレース対象のコードは `exec()` 経由で実行するため、top-level `await` は使えない
  （通常実行の `runPythonAsync` とは異なる制約）。
- Pyodide 初期化直後（ユーザーコードを一度も実行する前）の globals のキー集合
  （`pyodide.worker.ts` の `pristineGlobalNames`）を記録し、`input` や `_pyodide_core` などの
  フレームワーク注入名をユーザー変数と区別して除外している。実行時点の `globals().keys()` を
  使うと、直前の通常実行で定義したユーザー変数まで消えてしまうため使わないこと。
- `EXTRACT_FIGS_CODE` / `EXTRACT_TURTLE_CODE`（`pyodide.worker.ts`）は import・一時変数を
  すべて関数内に閉じ込めること。トップレベルに置くと `__main__` に残り、次回以降のステップ
  実行の変数一覧にトレーサ自身の内部状態（`_sys`/`_out`等）が混入する。関数名自体は "__" で
  始まり終わるため `traceModule.ts` の除外フィルタに含まれる。
- 値の `repr()` は `reprlib.Repr` の独自サブクラス（`_NarapyRepr`）を使う。素の `repr()` は
  巨大なコレクションで全長を構築してから切るため計算コストに上限が無い。`reprlib.Repr` 標準の
  `repr_dict`/`repr_set`/`repr_frozenset` も `islice` の前に全要素を並べ替えるため実質 O(n) の
  ままで、`Counter`/`OrderedDict`/`defaultdict` 等の dict/set サブクラスは `repr_instance` 経由で
  同じ問題を起こす。`_NarapyRepr` はこれらを `itertools.islice` で直接打ち切ることで回避している
  ため、このクラスの実装を素の `reprlib.Repr` に戻さないこと。`repr_instance` の判定は
  `collections.abc.Mapping`/`MappingView`/`Set` を使い、`isinstance(x, dict)` のような厳密な型
  判定や「要素数が閾値を超える場合のみ迂回」というサイズガードを**復活させないこと**
  （dict.keys()等のビュー・UserDict・キー数少値巨大なdefaultdictを再び取りこぼす上、
  自己参照するCounter（`v=Counter(); v['self']=v`）でPyodideランタイムごと即死する
  再現可能なバグも再発する。`Counter.__repr__` は毎回新しい dict を作るため CPython の循環
  参照検出（`Py_ReprEnter`）が効かず、素の `repr()` に落ちるとWASM上でJSスタックが尽きる）。
  既知のトレードオフ: このため `defaultdict` は `default_factory` の表示（`<class 'int'>`等）を
  失い、`Counter` の変数パネル表示順は挿入順（`print()` の most_common 順とは異なる）。
- 標準出力（print）はステップの進行に同期させている。トレース対象コードの実行中は
  `contextlib.redirect_stdout()` で `sys.stdout` を `_Recorder` 内の `io.StringIO` へ差し替え、
  既存の pyodide stdout コールバック（実行ログへのライブ配信）を経由させない。各ステップを
  記録するたびにバッファの差分を `TraceStep.stdout` として持たせ、UI 側
  （`trace/session.ts` の `cumulativeStdout()`）は先頭から現在のステップまでの `stdout` を
  連結して「ここまでの出力」として表示する。ステップ上限による打ち切り後に全速実行された
  分の出力はどのステップにも紐付かないため、`TraceResult.trailingStdout` として別枠で持ち、
  最終ステップに到達したときだけ末尾へ付け足す。通常実行（`mode !== 'trace'`）は redirect_stdout
  の対象外で、従来どおり実行ログへライブ配信される。
- MVP では関数呼び出しスタックの可視化・実行中の turtle 段階描画は対象外
  （turtle/matplotlib の描画結果は通常実行と同様、完了後にモーダルで表示される）。

### ビルドターゲット（`esnext`）

`vite-plugin-top-level-await` を廃止したため、`vite.config.ts` の `build.target: 'esnext'` が
`src/main.ts` のトップレベル `await`（`initStore()` / `applyUrlLoad()`）をネイティブESMのトップレベル
awaitとしてそのまま出力する唯一の手段になっている。`target` を下げるとビルドが壊れる。

### カラーパレットとテーマ

配色の単一の真実は `src/theme/palette.ts`（`DARK_PALETTE` / `LIGHT_PALETTE`）。
`src/style.css` が同じ値を `@theme`（ダーク＝既定）と `:root[data-theme='light']` /
`@media (prefers-color-scheme: light) :root:not([data-theme])` にミラーし、
Tailwind ユーティリティ（`bg-panel` / `text-muted` / `border-line` …）を生成する。

- **CSS から TS は import できない**ため、この 2 箇所の重複だけは避けられない。
  ずれると `src/theme/palette.test.ts` が落ちる（両方を必ず同時に直すこと）。
- Monaco のテーマ定義は CSS 変数を解釈できず **hex を要求する**。
  リファレンスの oklch 値は hex に変換して `palette.ts` に持っている。oklch を書かないこと。
- テーマ選択は `src/theme/index.ts`。`system` のときは `data-theme` 属性を**外し**、
  CSS のメディアクエリに任せる（CSP でインラインスクリプトを禁止しているため、
  JS 実行前のちらつきを CSS だけで防ぐ必要がある）。
- Monaco には `onThemeChange()` で通知して `setTheme()` させる。

## コーディング規約

- イミュータブルパターンを徹底（オブジェクトの直接変更禁止）
- ファイルは 800 行以内、関数は 50 行以内
- `console.log` は残さない
- コメントは「なぜ」が自明でない箇所のみ
- 1作業ごとにコミットすること
