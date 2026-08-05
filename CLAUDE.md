# Narapy — Claude Code ガイド

Python学習向けWebアプリのプロトタイプ。フロントエンド完結型アーキテクチャ（サーバー不要）。

## 技術スタック

| レイヤー       | 技術                                                                |
| -------------- | ------------------------------------------------------------------- |
| ビルド         | Vite 6 + TypeScript (Vanilla TS、フレームワークなし)                |
| スタイル       | Tailwind CSS v4（`@tailwindcss/vite` プラグイン、設定ファイル不要） |
| ブロックUI     | Google Blockly 12                                                   |
| Python実行     | Pyodide v0.27（Web Worker経由）                                     |
| コアエンジン   | Rust → wasm-pack → WebAssembly                                      |
| パッケージ管理 | **pnpm のみ**（npm / yarn 禁止）                                    |

## ディレクトリ構造

```
narapy/
├── core/                  # Rust製パーサー/バリデーターエンジン
│   ├── Cargo.toml         # wasm-bindgen / rustpython-parser / serde
│   └── src/lib.rs         # parse_and_validate() — JS から呼び出す WASM API
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts            # エントリポイント（Blockly初期化・WASM連携・Worker通信）
│   ├── pyodide.worker.ts  # Pyodide を動的 import で初期化する Web Worker
│   ├── style.css          # Tailwind v4 + Blockly 向けグローバルスタイル
│   └── wasm/              # wasm-pack ビルド成果物（gitignore済み、要ビルド）
├── index.html             # 2カラムレイアウト（左:Blockly / 右:エディタ+ログ）
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 開発コマンド

```bash
# 初回セットアップ（Rust→WASM ビルド + Vite 起動）
pnpm dev

# WASM のみ再ビルド（Rustコード変更時）
pnpm build:wasm

# プロダクションビルド
pnpm build

# 型チェック
pnpm typecheck
```

> **注意:** `src/wasm/` は gitignore 済みのためクローン後は必ず `pnpm dev`（または `pnpm build:wasm`）を実行すること。

## アーキテクチャ上の重要事項

### COOP/COEP ヘッダー

`SharedArrayBuffer`（Pyodide に必要）のため `vite.config.ts` の `server.headers` に以下を設定済み。
S3/CloudFront デプロイ時も同様のヘッダーを付与すること。

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Blockly メディアファイル

外部 CDN（`blockly-demo.appspot.com`）が COEP でブロックされるため、`vite-plugin-static-copy` で `node_modules/blockly/media/*` を `/blockly-media/` にコピーし、`inject()` の `media` オプションで指定している。

### Blockly の ESM 読み込み

Blockly 12 は CJS モジュールのため `optimizeDeps.include` に追加して esbuild でプリバンドルしている。`import * as Blockly` は使わず named import を使うこと。

### Pyodide Web Worker

`type: 'module'` の Worker では `importScripts()` が禁止。`/* @vite-ignore */` コメント付きの dynamic `import()` で CDN から読み込んでいる。

### カラーパレットとテーマ

配色の単一の真実は `src/theme/palette.ts`（`DARK_PALETTE` / `LIGHT_PALETTE`）。
`src/style.css` が同じ値を `@theme`（ダーク＝既定）と `:root[data-theme='light']` /
`@media (prefers-color-scheme: light) :root:not([data-theme])` にミラーし、
Tailwind ユーティリティ（`bg-panel` / `text-muted` / `border-line` …）を生成する。

- **CSS から TS は import できない**ため、この 2 箇所の重複だけは避けられない。
  ずれると `src/theme/palette.test.ts` が落ちる（両方を必ず同時に直すこと）。
- Monaco と Blockly のテーマ定義は CSS 変数を解釈できず **hex を要求する**。
  リファレンスの oklch 値は hex に変換して `palette.ts` に持っている。oklch を書かないこと。
- テーマ選択は `src/theme/index.ts`。`system` のときは `data-theme` 属性を**外し**、
  CSS のメディアクエリに任せる（CSP でインラインスクリプトを禁止しているため、
  JS 実行前のちらつきを CSS だけで防ぐ必要がある）。
- Monaco / Blockly には `onThemeChange()` で通知して `setTheme()` させる。
  Blockly の方眼（`grid.colour`）だけは `inject()` 時にしか読まれないため、
  両テーマで成立する固定の中間グレーを使っている。

### WASM モジュールの利用パターン

```typescript
import init, { parse_and_validate } from './wasm/narapy_core.js'
await init()
const result = parse_and_validate(code) // Ok("{"status":"success"}") or throws
```

## Rust コア (`core/`)

`parse_and_validate(source: &str) -> Result<String, String>` のスケルトン実装。
現状は `"lambda"` / `"["` を含む場合にエラーを返す簡易チェック。
将来的には `rustpython_parser::parse()` で本格的な AST バリデーションに置き換える。

```bash
# WASM ターゲットへのビルド（wasm-pack 必須）
cd core && wasm-pack build --target web --out-dir ../src/wasm
```

## コーディング規約

- イミュータブルパターンを徹底（オブジェクトの直接変更禁止）
- ファイルは 800 行以内、関数は 50 行以内
- `console.log` は残さない
- コメントは「なぜ」が自明でない箇所のみ
- 1作業ごとにコミットすること
