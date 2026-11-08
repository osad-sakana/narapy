# デプロイ手順書

本番は **S3 + CloudFront** で配信する。公開リポジトリなので、実際のアカウント ID・バケット名・
ディストリビューション ID・ロール ARN はここに書かない（GitHub Variables と AWS コンソールで管理する）。

## 構成

```
GitHub (main) ──push──▶ GitHub Actions ──OIDC──▶ IAM ロール
                              │                      │
                              ▼                      ▼
                         pnpm build ─▶ dist/ ─▶ S3（非公開）◀──OAC── CloudFront ◀── Route 53 (Alias) ◀── ユーザー
                                                                          │
                                                       ACM 証明書 / Function / Response Headers Policy
```

| 要素 | 役割 |
|---|---|
| S3 バケット | `dist/` の置き場。パブリックアクセスはすべてブロックし、CloudFront の OAC だけが読む |
| CloudFront | HTTPS 配信。HTTP は HTTPS へリダイレクト |
| Response Headers Policy | `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp`（Pyodide の SharedArrayBuffer に必要）。加えて下記「推奨セキュリティヘッダー」 |
| CloudFront Function（viewer request） | 拡張子なしのパスを補完（`/make-url` → `/make-url.html`、`/` → `/index.html`） |
| ACM 証明書 | CloudFront 用は **`us-east-1`** で発行する |
| Route 53 | 公開ドメインの A / AAAA（Alias）を CloudFront に向ける |

## 通常のデプロイ

1. 変更を PR にする。PR では `ci.yml` の `test` と `build` が走る。
2. 両方が緑になったら main へマージする。
3. main への push で `.github/workflows/deploy.yml` が自動で動く。
   - `pnpm build` → OIDC でロールを引き受け → `aws s3 sync` → CloudFront の無効化（`/*`）
4. Actions の **Deploy (S3 + CloudFront)** が成功したことを確認する。

```bash
gh run list --workflow deploy.yml --limit 3
```

手動で再実行したいとき（main のみ）:

```bash
gh workflow run deploy.yml
```

### キャッシュの扱い

| 対象 | Cache-Control | 理由 |
|---|---|---|
| `assets/`（ファイル名にハッシュ付き） | `public,max-age=31536000,immutable` | 内容が変われば名前が変わるため。`--delete` しない（古い版を参照中のタブを壊さない） |
| それ以外（`index.html` など） | `no-cache` | 名前が変わらないので毎回再検証させる。`--delete` する |

デプロイのたびに CloudFront を `/*` で無効化する（月 1000 パスまで無料、`/*` は 1 パス扱い）。

## デプロイ後の確認

```bash
curl -sI https://<ドメイン>/
```

- 先頭が `HTTP/2 200`
- `cross-origin-opener-policy: same-origin` と `cross-origin-embedder-policy: require-corp` がある
- `server: AmazonS3`、`x-cache`、`via: …cloudfront.net` が出る

ブラウザで次を確認する。

- Python が実行できる（SharedArrayBuffer が有効）
- `/make-url` と `/make-exercise` が開く
- DevTools のコンソールに COOP/COEP のエラーが出ていない

DNS の反映待ちやキャッシュで引けないときは、IP を指定して配信側だけを確認できる。

```bash
curl -sI --resolve <ドメイン>:443:<CloudFront の IP> https://<ドメイン>/
```

## ロールバック

main の変更を `git revert` で PR にして、マージする（再びデプロイが走る）。`assets/` は
削除しないので、直前の版のファイルも S3 に残っている。

## GitHub の設定

Settings → Secrets and variables → Actions → **Variables**（Secrets ではない）:

| 名前 | 値 |
|---|---|
| `AWS_ROLE_ARN` | デプロイ用 IAM ロールの ARN |
| `S3_BUCKET` | バケット名 |
| `CLOUDFRONT_DISTRIBUTION_ID` | ディストリビューション ID（`E…`） |
| `SITE_URL` | 公開URL（`https://<ドメイン>`）。OGP の `og:url` / `og:image`（絶対URL）に使う。未設定でもデプロイは通るが、この2つが出力されずリンクプレビューに画像が出ない |

Secrets は使わない（OIDC のため保存する秘密がない）。

## 初期構築のメモ（再構築するとき）

1. **ACM**（`us-east-1`）: 公開ドメインの証明書を DNS 検証で発行する。Route 53 で検証レコードを作成するボタンが使える。
2. **S3**: バケットを作る。パブリックアクセスはすべてブロックのまま。
3. **CloudFront Function** `narapy-rewrite`（viewer request）:

   ```javascript
   function handler(event) {
     var req = event.request;
     var uri = req.uri;
     if (uri.endsWith('/')) {
       req.uri = uri + 'index.html';
     } else if (uri.indexOf('.') === -1) {
       req.uri = uri + '.html';
     }
     return req;
   }
   ```

4. **Response Headers Policy** `narapy-coop-coep`: カスタムヘッダー 2 つ（上の表）を「オリジンの値を上書き」オンで設定する。
5. **ディストリビューション**（**従量課金プラン**で作る。定額の Free プランではカスタムのヘッダーポリシーを選べない）:
   - オリジン: S3 の REST エンドポイント + OAC。作成後に表示されるバケットポリシーを S3 に貼る
   - ビューワープロトコル: HTTP を HTTPS にリダイレクト、圧縮オン、キャッシュポリシーは CachingOptimized
   - Response Headers Policy と Function（viewer request）を関連付け
   - 代替ドメイン名・ACM 証明書・デフォルトルートオブジェクト `index.html`
   - WAF は有効にしない（費用が増える）
6. **Route 53**: 公開ドメインの A と AAAA を Alias で CloudFront に向ける。
7. **IAM**:
   - ID プロバイダ `token.actions.githubusercontent.com`（Audience `sts.amazonaws.com`）を追加する
   - ポリシー: 対象バケットの `s3:ListBucket`、バケット配下の `s3:PutObject` / `s3:DeleteObject` / `s3:GetObject`、対象ディストリビューションの `cloudfront:CreateInvalidation` だけを許可する
   - ロールの信頼ポリシーは、リポジトリの `main` ブランチだけに絞る:

     ```json
     "Condition": {
       "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
       "StringLike": { "token.actions.githubusercontent.com:sub": "repo:<owner>/<repo>:ref:refs/heads/main" }
     }
     ```

     PR や他のブランチ、フォークからはロールを引き受けられない。

## 課金の備え

CloudFront の従量課金には上限がない。無料枠（毎月 1TB・1000 万リクエスト）を超えると転送量に応じて課金される。

- **AWS Budgets**: 月額 $5 で、予測 50%・予測 100%・実績 100% の通知を設定している
- 通知が来たら、請求画面で CloudFront の金額を確認し、想定外なら **CloudFront の対象ディストリビューションを「無効にする」**（課金がすぐ止まる）。原因を調べてから有効に戻す

## トラブルシュート

| 症状 | 原因の目安 |
|---|---|
| Actions で `Could not assume role` / `AssumeRoleWithWebIdentity` | ロールの信頼ポリシーの `sub`（リポジトリ・ブランチ）や OIDC プロバイダー |
| Actions の S3 で `AccessDenied` | ロールのポリシーのバケット名、`S3_BUCKET` の値 |
| Actions の CloudFront で `AccessDenied` | ロールのポリシーのディストリビューション ID、`CLOUDFRONT_DISTRIBUTION_ID` の値 |
| ブラウザで `403` | バケットポリシー（OAC）が貼られていない、または別のディストリビューション向け |
| 証明書エラー | ACM が `us-east-1` で発行済みか、代替ドメイン名の設定 |
| 名前が引けない | Route 53 のレコード、ディストリビューションが有効か（無効だと Alias が応答しない） |
| `/make-url` が 404 | CloudFront Function が viewer request に関連付けられ、公開されているか |
| COOP/COEP のヘッダーがない | 動作（Behavior）の Response Headers Policy の関連付け。Free プランだと選べない |
| 更新が反映されない | 無効化が完了しているか（数十秒〜数分）、ブラウザのキャッシュ |

## 推奨セキュリティヘッダー

Response Headers Policy（`narapy-coop-coep`）に次を足す。いずれも「オリジンの値を上書き」オン。`<meta>` の CSP では `frame-ancestors` が使えず、クリックジャッキング対策はヘッダーでしかできない。

| ヘッダー | 値 | 目的 |
|---|---|---|
| `Content-Security-Policy` | `index.html` の `<meta>` と同じ内容 + `frame-ancestors 'none'` | XSS の被害抑止・他サイトへの埋め込み禁止 |
| `X-Content-Type-Options` | `nosniff` | MIME スニッフィング防止 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS 強制 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | URL（`?project=` 等）の漏えい抑制 |

CSP の中身は `vite.config.ts` の `server.headers` と `index.html` の meta と同じにする（3 か所を同期）。反映後は本番で「実行」と `#code=` の読み込みが動くことを確認する。
