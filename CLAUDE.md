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
