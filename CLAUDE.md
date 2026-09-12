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
  `/home/pyodide/` 始まりの仮想パスで compile し、'call' イベントでその prefix を判定することで
  ユーザー定義の関数呼び出しは追跡しつつ site-packages/stdlib の内部呼び出しを自動的に除外する。
- ステップ数の上限（800）に達すると `sys.settrace(None)` して残りを全速で完走させる
  （`while True:` などの無限ループでもブラウザが固まらないようにするため）。
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
- 実行開始前に既存の globals のキー集合を記録し、`input` や `_pyodide_core` などの
  フレームワーク注入名をユーザー変数と区別して除外している。
- MVP では関数呼び出しスタックの可視化・実行中の turtle 段階描画・出力のステップ同期
  （print 出力とステップ位置の対応付け）は対象外。既存の実行ログにそのまま出力される。

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
