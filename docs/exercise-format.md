# 演習(.exercise)フォーマットと自動採点（issue #65）

お題（problem.md）・初期コード・テストケース（test.py）をひとまとめにした演習パッケージを
URLだけで配布・採点できるようにする機能です。既存の[URLからのプロジェクト読み込み](url-loading.md)
（`#project=` / `?project=<URL>` / ファイルピッカー）をそのまま流用しています。

## `.exercise` は `.narapy` と同じzipコンテナ

新しいフォーマットを作らず、`.narapy`（zipアーカイブ: `narapy.json` + `files/<path>`）に
`exercise` という任意フィールドを足しただけです。

```json
{
  "version": 2,
  "activeFile": "main.py",
  "directories": [],
  "exercise": { "problem": "problem.md", "test": "test.py" }
}
```

- `exercise.problem` / `exercise.test`: プロジェクト内のファイルパス（`files/` プレフィックスは除く）
- `exercise` フィールドが無ければ、これまで通りの `.narapy` プロジェクトとして開かれる（後方互換）
- `activeFile` は「採点対象として固定されるファイル」を兼ねる。学生がエクスプローラで
  problem.md や test.py を開いたまま採点ボタンを押しても、常にこのファイルの内容が
  採点される（エディタの表示中ファイルには依存しない）

拡張子は `.narapy` と `.exercise` のどちらでも構いません（ファイルピッカーの `accept` 属性は
両方許可しています）。中身は同じzip形式なので、`exercise` フィールドの有無だけが違いです。

### 開き方

- ローカルの `.exercise` ファイル: 「プロジェクトを開く」ボタン
- URLで自己完結配布: `#project=<zlib圧縮+base64url化したアーカイブ>`（[url-loading.md](url-loading.md)参照）
- リポジトリ同梱の公式問題: `?project=/exercises/<name>.exercise`（`public/exercises/` 配下、
  例: `?project=/exercises/add_two_numbers.exercise`）
- 外部サーバーでの動的配布: `?project=<URL>`（CORS必要）

## test.py の作成契約

採点エンジン（`src/pyodide/gradeModule.ts`）は test.py を次のルールで解釈します。

- **トップレベルの `def test_xxx(): ...` のみ**をテストケースとして収集する（`test_` で始まる
  引数ゼロの関数）。`async def` やクラスメソッドは対象外
- 各テストケースは**ケースごとにフレッシュな名前空間**でユーザーコード→該当test関数の順に
  実行される。あるケースでの変数の変更が別のケースに漏れることはない
- 標準出力を検証したい場合は `__narapy_stdout__`（ユーザーコード実行中の標準出力をキャプチャした
  文字列）を参照する: `assert __narapy_stdout__.strip() == "合格"`
- ユーザーコードは通常実行と同じ扱いで `__name__ == "__main__"` になる
  （`if __name__ == "__main__":` の中身も採点時に実行される）
- **`input()` は非対応**（v1スコープ外）。使われた場合は「採点ではinput()は使用できません」という
  メッセージで不合格になる
- ユーザーコードが自分自身をモジュールとして `import`/`from ... import` することも可能
  （通常の複数ファイルプロジェクトと同様）。この場合もケースごとに再import相当の扱いになるよう
  内部で `sys.modules` キャッシュをケースごとに破棄しているため、フレッシュ実行の保証は崩れない
- 例外は自動でキャッチされ、`AssertionError` はメッセージをそのまま、それ以外の例外は
  通常実行時と同じ形式のトレースバックとして返す。後者は既存のエラー翻訳
  （`src/runner/errorTranslator.ts`）を通して日本語化される

## 信頼モデル

`#project=`/`?project=<URL>` で読み込んだ `.exercise` の test.py（および main.py）は、
通常のPythonコードと同じくブラウザ内Pyodideで実行されます。これは共有 `.narapy` の
main.py を「実行」ボタンで動かすのと同じ信頼モデルです。差分は、test.py がエディタに
表示されない（＝内容を目視確認しないまま「採点」を押すと実行される）点です。
出どころの分からないURLの演習を開く際は、ふつうの `.narapy`/コード共有URLと同様の
注意（知らない相手からのリンクを不用意に開かない）を払ってください。

`problem.md` はPythonコードとして実行されることはありませんが、表示は常に
プレーンテキストとしてエスケープ表示されます（`src/exercise/problemModal.ts`）。
Markdownの書式付きレンダリングは意図的に行っていません（第三者が用意した内容を
`innerHTML` 等で解釈するとXSSにつながるため）。

## サンプル

`public/exercises/` に2件のサンプルがあります。

- `add_two_numbers.exercise`: 関数実装型（`add(a, b)` を実装する）
- `score_judge.exercise`: 標準出力比較型（if/elifの練習、`__narapy_stdout__` で検証）
