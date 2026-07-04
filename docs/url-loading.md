# URLからの初期コード・プロジェクト読み込み（外部サイト連携ガイド）

教材サイトなど外部サイトから「このコードから始める」リンクでNarapyを開けるようにする機能です（issue #32）。
3つの方式があり、いずれも追加ライブラリなしで [fflate](https://github.com/101arrowz/fflate) だけで生成できます。

## 方式の選び方

| 方式 | 用途 | 外部サイト側のstorage | サイズ上限の目安 |
| --- | --- | --- | --- |
| `#code=<...>` | 単一ファイル (`main.py`) で始めたい | 不要 | 圧縮後 数十KB |
| `#project=<...>` | 複数ファイル・**外部サイト連携の推奨方式** | 不要 | 圧縮後 数十KB |
| `?project=<URL>` | 画像等を含む大きめのプロジェクト | 動的生成エンドポイントでよい | 実質なし（要CORS） |

まず `#project=` で始め、教材にファイルが増えてサイズが問題になったら `?project=<URL>` を追加するのが低コストです。

### なぜハッシュ (`#`) を使うのか

`#code=` / `#project=` の値はURLのフラグメント（`#`以降）に置きます。フラグメントはブラウザからサーバーに送信されないため、アクセスログに残らず、CORS設定も不要です。

### 注意: postMessage方式は使えない

「`window.open` でNarapyを開いて `postMessage` でデータを送る」設計は**動作しません**。NarapyはPyodide (`SharedArrayBuffer`) のために `Cross-Origin-Opener-Policy: same-origin` を設定しており、このヘッダーが別オリジンとの `window.opener` 関係を切断するためです。外部サイト連携はこの前提を崩さないでください。

---

## 1. `#code=<...>`: 単一コードを開く

Pythonコードを `zlib` 圧縮してbase64url化し、ハッシュに埋め込みます。

```javascript
import { strToU8, zlibSync } from 'fflate'

function toBase64Url(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildCodeUrl(pythonSource) {
  const compressed = zlibSync(strToU8(pythonSource), { level: 9 })
  return `https://<narapyのURL>/#code=${toBase64Url(compressed)}`
}
```

## 2. `#project=<...>`: 複数ファイルを開く（推奨）

`.narapy` 形式（zipアーカイブ）を組み立て、それをさらに `zlib` 圧縮してbase64url化します。
`.narapy` の内部構造は以下の通りです。

- `narapy.json`: `{ "version": 2, "activeFile": "main.py", "directories": [] }`
- `files/<path>`: 各ファイルの内容（相対パスをそのままエントリ名に使う）

```javascript
import { strToU8, zipSync, zlibSync } from 'fflate'

function buildProjectUrl(files, activeFile = 'main.py') {
  const metadata = { version: 2, activeFile, directories: [] }
  const archiveEntries = { 'narapy.json': strToU8(JSON.stringify(metadata)) }
  for (const [path, content] of Object.entries(files)) {
    archiveEntries[`files/${path}`] = strToU8(content)
  }
  const archive = zipSync(archiveEntries)
  const compressed = zlibSync(archive, { level: 9 })
  return `https://<narapyのURL>/#project=${toBase64Url(compressed)}`
}

// 例
buildProjectUrl({
  'main.py': 'print("hello")',
  'util.py': 'def greet():\n    return "hi"',
})
```

## 3. `?project=<URL>`: 外部URLの.narapyを自動ロード

教材サイト側に `.narapy` を動的生成して返すエンドポイントを用意し、そのURLを `?project=` に渡します。
こちらはハッシュではなく通常のクエリ文字列です。

```
https://<narapyのURL>/?project=https://your-materials-site.example.com/api/exercises/42.narapy
```

### 提供側の要件

- レスポンスに `Access-Control-Allow-Origin` ヘッダーが必要です（CORS）。Narapyは `fetch(url, { mode: 'cors' })` で取得します。
- レスポンスボディはそのまま `.narapy` のバイト列（追加のbase64/zlib圧縮は不要）。
- サイズは10MBを超えるとNarapy側でエラーになります。
- 取得失敗・CORSエラー・不正な形式は、いずれも日本語のエラーメッセージがダイアログで表示されます（無言で失敗しません）。

### Narapyを自前デプロイする場合の注意

`vite.config.ts` の Content-Security-Policy には `connect-src` に `https:` を許可しています。
自前でホスティングする場合も、S3/CloudFront等で同等のCSP/COOP/COEPヘッダーを付与してください
（`connect-src` から `https:` を外すと `?project=<URL>` が動作しなくなります）。

---

## 他のクエリパラメータとの併用

Blockly有効化フラグ（issue #31, `?blockly=1`）と併用できます。

```
https://<narapyのURL>/?blockly=1&project=https://your-materials-site.example.com/api/exercises/42.narapy
```

## 既存の作業内容の扱い

ブラウザに既存の作業内容（IndexedDBに保存済みのファイル）がある場合、URLからの読み込みは
確認ダイアログを表示してから上書きします。何も編集されていない初期状態であれば確認なしで
そのまま読み込みます。
