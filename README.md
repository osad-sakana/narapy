<div align="center">

<img src="public/favicon.svg" alt="Narapy" width="96" height="96" />

# Narapy

**ブロックと Python を行き来しながら学べる、ブラウザ完結型 Python 学習環境**

[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Blockly](https://img.shields.io/badge/Blockly-12-4285F4?logo=google&logoColor=white)](https://developers.google.com/blockly)
[![Pyodide](https://img.shields.io/badge/Pyodide-0.27-3776AB?logo=python&logoColor=white)](https://pyodide.org/)
[![Rust → WASM](https://img.shields.io/badge/Rust-WASM-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)

</div>

---

## ✨ Narapy とは

**Narapy** は、ビジュアルプログラミング（ブロック）とテキストの Python コードを
**双方向に変換**しながら学べる Web アプリです。
ブロックを組めば Python コードになり、Python を書けばブロックに戻る ——
「触って覚える」から「書いて理解する」へ、なめらかに橋渡しします。

サーバーは不要。**すべてブラウザの中で完結**します。Python の実行も、コードの検証も、
タートルグラフィックスの描画も、すべてあなたの手元のブラウザで動きます。

> 💡 標準ライブラリの `turtle` 互換モジュールを内蔵。`import turtle` で図形描画の授業がそのまま動きます。

---

## 🎯 主な機能

| 機能 | 説明 |
| --- | --- |
| 🧩 **ブロック ⇄ Python 双方向変換** | Blockly で組んだブロックが Python に、書いた Python がブロックに即変換 |
| 🐍 **ブラウザ内 Python 実行** | Pyodide を Web Worker で動かし、メインスレッドを止めずに実行 |
| 🐢 **タートルグラフィックス** | Tkinter 不要の Canvas 独自実装。アニメーション付きで図形を描画 |
| ⚡ **高速な構文検証** | Rust 製エンジンを WebAssembly 化し、リアルタイムにコードを検証 |
| 📂 **プロジェクト保存・復元** | 複数ファイルを `.narapy` 形式で書き出し／読み込み |
| 🎨 **3 パネル UI** | ブロック・エディタ・実行ログを自由に表示／非表示、サイズ調整も自在 |
| 🔤 **読みやすさ重視** | UI に BIZ UDPGothic、コードに 0xProto を採用。フォントサイズも調整可能 |

---

## 🚀 クイックスタート

> **前提:** [Node.js](https://nodejs.org/) 22+ / [pnpm](https://pnpm.io/) 10+ / [Rust](https://www.rust-lang.org/) + [wasm-pack](https://rustwasm.github.io/wasm-pack/)
> パッケージ管理は **pnpm のみ**（npm / yarn は使用しないでください）

```bash
# 依存関係をインストール
pnpm install

# Rust → WASM ビルド + 開発サーバー起動（初回はこれだけで OK）
pnpm dev
```

ブラウザで表示された URL（通常 `http://localhost:5173`）を開けば、すぐに使い始められます。

> ⚠️ `src/wasm/` は gitignore 済みです。クローン直後は必ず `pnpm dev`（または `pnpm build:wasm`）を実行して WASM を生成してください。

---

## 🛠️ 開発コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | WASM ビルド → 開発サーバー起動 |
| `pnpm build` | WASM ビルド → プロダクションビルド |
| `pnpm build:wasm` | Rust コア（`core/`）のみ WASM 再ビルド |
| `pnpm preview` | プロダクションビルドのプレビュー |
| `pnpm typecheck` | TypeScript 型チェック（`tsc --noEmit`） |
| `pnpm test` | Vitest でテスト実行 |
| `pnpm test:watch` | Vitest をウォッチモードで実行 |

---

## 🏗️ アーキテクチャ

Narapy は **フロントエンド完結型**。バックエンドサーバーを持たず、
重い処理（Python 実行・構文検証）は Web Worker と WebAssembly に逃がしています。

```
┌─────────────────────────────────────────────────────────────┐
│                     ブラウザ (UI スレッド)                     │
│                                                               │
│   🧩 Blockly  ⇄  🐍 Monaco エディタ  ⇄  🐢 Turtle Canvas       │
│        │                  │                                   │
│        └──────────┬───────┘                                   │
│                   ▼                                           │
│        ┌──────────────────┐      ┌──────────────────┐         │
│        │  Rust → WASM      │      │  Pyodide Worker   │         │
│        │  構文検証・IR変換  │      │  Python 実行      │         │
│        └──────────────────┘      └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 技術スタック

| レイヤー | 採用技術 |
| --- | --- |
| ビルド | Vite 6 + TypeScript（Vanilla TS、フレームワークなし） |
| スタイル | Tailwind CSS v4（`@tailwindcss/vite`、設定ファイル不要） |
| ブロック UI | Google Blockly 12 |
| コードエディタ | Monaco Editor |
| Python 実行 | Pyodide 0.27（Web Worker 経由） |
| コアエンジン | Rust → wasm-pack → WebAssembly |

### ディレクトリ構成

```
narapy/
├── core/                  # Rust 製パーサー / バリデーター / IR コンバーター
│   └── src/
│       ├── lib.rs         #   WASM API エントリ（JS から呼ぶ）
│       ├── converter.rs   #   Python ⇄ 中間表現(IR) 変換
│       └── ir.rs          #   中間表現の定義
├── src/
│   ├── main.ts            # エントリポイント（初期化・各モジュール連携）
│   ├── blockly/           # Blockly ワークスペース・カスタムブロック
│   ├── converter/         # IR ⇄ Blockly 変換・変数レジストリ
│   ├── editor/            # Monaco エディタ
│   ├── runner/            # 実行・検証・Turtle 描画・エラー翻訳
│   ├── pyodide/           # Pyodide 連携
│   ├── explorer/          # ファイルエクスプローラー
│   ├── fileio/            # .narapy プロジェクト入出力
│   ├── layout/            # パネルレイアウト（split.js）
│   ├── about/             # ライセンス表示
│   ├── pyodide.worker.ts  # Pyodide 初期化 Web Worker
│   └── wasm/              # wasm-pack ビルド成果物（gitignore 済み）
├── docs/
│   └── turtle-reference.md # 教材作成者向け Turtle リファレンス
└── index.html             # 3 パネルレイアウト（ブロック / エディタ / ログ）
```

---

## 🐢 タートルグラフィックス

標準 Python の `turtle` は Tkinter 依存でブラウザでは動きませんが、
Narapy は **Canvas 上に描く独自実装**を内蔵しています。
`import turtle` でそのまま書け、実行すると描画モーダルがアニメーション表示されます。

```python
import turtle

for _ in range(4):
    turtle.forward(100)
    turtle.right(90)
```

- 原点 `(0, 0)` は画面中央、X は右が +、Y は上が +（数学・標準 turtle と同じ）
- モジュール関数（`turtle.forward(...)`）でも `Turtle` インスタンスでも記述可能

> 対応 API の一覧や教材作成時の注意点は [`docs/turtle-reference.md`](docs/turtle-reference.md) を参照してください。

---

## 📝 実装メモ

ブラウザの制約まわりで知っておくと役立つポイントです。

- **COOP/COEP ヘッダー** — `SharedArrayBuffer`（Pyodide に必要）のため、開発時は `vite.config.ts` の `server.headers` で付与。GitHub Pages 等ヘッダーを設定できない環境では [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) で代替しています。
- **Blockly メディア** — 外部 CDN が COEP でブロックされるため、`vite-plugin-static-copy` で `blockly/media/*` をローカルへコピーして配信。
- **Pyodide Worker** — `type: 'module'` の Worker では `importScripts()` が使えないため、`import()` で CDN から動的読み込み。

詳細は [`CLAUDE.md`](CLAUDE.md) にまとまっています。

---

## 🚢 デプロイ

`main` ブランチへの push で GitHub Actions が自動デプロイします
（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）。
S3 / CloudFront などへ手動デプロイする場合は、上記の **COOP/COEP 相当のヘッダー付与**を忘れずに。

---

<div align="center">

Made with 🧩 + 🐍 — *ブロックから、コードへ。*

</div>
