# URLからの初期コード・プロジェクト読み込み（外部サイト連携ガイド）

教材サイトなど外部サイトから「このコードから始める」リンクでNarapyを開けるようにする機能です（issue #32）。
3つの方式があり、いずれも追加ライブラリなしで [fflate](https://github.com/101arrowz/fflate) だけで生成できます。

## `/make-url`: リンクをブラウザ上で生成する

Node.jsスクリプトを書かなくても、Narapy自身に組み込まれた `/make-url`（`make-url.html`）ページで
`#code=` / `#project=` のリンクを作成できます。教材作成者（管理者）向けのツールで、
アプリ本体（`index.html`）からの導線はあえて設けていません。URLを直接開いてください。

- 単一コード: Pythonコードを貼り付けるだけで `#code=` リンクを生成
- 複数ファイル: ファイルを追加し、パスと内容を入力（ラジオボタンを選択した状態のファイルが、開いた状態＝アクティブなファイルになります）
- 生成されたリンクの「NarapyのURL」欄は現在開いているページのディレクトリを既定値にしていますが、配布先のドメインに応じて書き換えてください

`?project=<URL>` は外部サーバーでの動的生成が前提のため、このページの対象外です（下記3章を参照）。

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

## 動作確認用サンプル（ローカル開発環境）

`pnpm dev` で開発サーバー（`http://localhost:5173`）を起動した状態で、以下のURLをブラウザで開くと動作を確認できます（実際に動作検証済み）。

### `#code=` の例

```
http://localhost:5173/#code=eNorKMrMK9FQ8kjNycnXUfBLLEosqFRU0uRKyy9SyFTIzFMoSsxLT9Uw1rTiUgACiPJMTQDshhC8
```

以下のPythonコードが `main.py` として開きます。

```python
print("Hello, Narapy!")
for i in range(3):
    print(i)
```

### `#project=` の例

```
http://localhost:5173/#project=eNoL8GZmEWFgYOBg-JH7JKYm2I_PHMgzBWJuIM5LLEosqNTLKs7PWx2m5a2rde7M-eBNRpcCvXz0Tup4l54-4xm6KeiU75kzl7VXhACFT-p4-eqd1D_loxu2qatvLSsDqvn6rgutlYE8VSDmBeK0zJzUYv3cxMw8vYJKb-1T50M1dE-eCTxxRveEvlagh76Xr-5DLY1TZ7QvMmw2NTFlRDVta_3Kfl0gD4QRppWWZOaATPP0DQYbcPHClkdBDE2Lrky6tMiGVbX_ypw5Na1bFv2Jab006YzM3iYvV1WgKxmZRBhwhwMqQAoVdI3oHkSABHTvomtF9w0CrEP3W4A3KxtIghkI1wNpNkYQDwCabXzk
```

`main.py` が `util.py` の `greet()` をimportして呼び出す2ファイル構成が開きます。

```python
# main.py
from util import greet
print(greet())

# util.py
def greet():
    return "Hello from util.py!"
```

上記2つのサンプルは、本ドキュメントの生成スクリプト（Node.js + fflate）で以下のように作成しました。

```javascript
const { strToU8, zlibSync, zipSync } = require('fflate')

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return Buffer.from(binary, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// #code=
const code = 'print("Hello, Narapy!")\nfor i in range(3):\n    print(i)'
console.log(bytesToBase64Url(zlibSync(strToU8(code), { level: 9 })))

// #project=
const metadata = { version: 2, activeFile: 'main.py', directories: [] }
const archive = zipSync({
  'narapy.json': strToU8(JSON.stringify(metadata)),
  'files/main.py': strToU8('from util import greet\nprint(greet())'),
  'files/util.py': strToU8('def greet():\n    return "Hello from util.py!"'),
})
console.log(bytesToBase64Url(zlibSync(archive, { level: 9 })))
```

`?project=<URL>` はCORS付きの外部サーバーが必要なため、手早く試すなら `#code=` / `#project=` のほうが手軽です。

---

## 既存の作業内容の扱い

ブラウザに既存の作業内容（IndexedDBに保存済みのファイル）がある場合、URLからの読み込みは
確認ダイアログを表示してから上書きします。何も編集されていない初期状態であれば確認なしで
そのまま読み込みます。
