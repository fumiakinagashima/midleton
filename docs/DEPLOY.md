# Cloudflareデプロイ手順（GitHub連携）

Midleton を GitHub 連携の Cloudflare Workers Builds で本番デプロイするための手順書。
「初回セットアップ（1〜4）」は一度だけ行う。5以降はGitHub連携の設定と、push毎の自動デプロイ運用。

前提:
- Cloudflareアカウント: `Alcogy`（`wrangler whoami` で確認済み、Account ID: `018b0c0b1be1205d80c26f5d184cfc1f`）
- GitHubリポジトリ: `alcogy/midleton`（`main` を本番ブランチとする）
- ローカルで `bunx wrangler login` 済み

---

## 1. D1データベース

`wrangler.toml` の `database_id`（`06f71c5e-2de6-4db4-b951-64705293e69a`、DB名 `midleton`）は**既に作成済み**（`wrangler d1 list` で確認済み、テーブル数0）。追加作業は不要。

## 2. KV Namespaceの作成

ローカル開発用のダミー値（`midleton-kv-local`）を本番用の実IDに置き換える。

```sh
bunx wrangler kv namespace create midleton
```

出力された `id` を `wrangler.toml` の以下の箇所に設定する:

```toml
[[kv_namespaces]]
binding = "KV"
id = "<ここに出力されたidを設定>"
```

## 3. R2バケットの作成

```sh
bunx wrangler r2 bucket create midleton
```

`wrangler.toml` の `bucket_name = "midleton"` はそのままでよい。

## 4. D1マイグレーションの適用（リモート）

```sh
bunx wrangler d1 migrations apply midleton --remote
```

全テーブルが作成される。**この時点では `accounts` テーブルは空**（ローカル開発用のテスト5アカウントはマイグレーションに含まれない、手動投入されたものなので本番には作られない）。

---

## 5. 初期管理者アカウントの投入（重要・必須）

全ルートがログイン必須かつサインアップ画面が存在しないため、最初の管理者アカウントを直接D1に投入する必要がある。**`password` のような弱いパスワードは使わず、本番用の強いパスワードを設定すること。**

### 5-1. パスワードハッシュを生成

```sh
bun -e "
import { hashPassword } from './src/lib/server/auth/password.ts';
console.log(await hashPassword('REPLACE_WITH_STRONG_PASSWORD'));
"
```

出力例: `pbkdf2:100000:xxxxxxxx...:yyyyyyyy...`

### 5-2. UUIDを生成

```sh
bun -e "console.log(crypto.randomUUID())"
```

### 5-3. INSERT文をファイルに作成して実行

`seed-admin.sql`（リポジトリにはコミットしない）:

```sql
INSERT INTO accounts (id, name, email, role, permission, password_hash)
VALUES ('<5-2で生成したUUID>', '<表示名>', 'info@alcogy.com', '<役職（任意、NULL可）>', 'admin', '<5-1で生成したハッシュ>');
```

```sh
bunx wrangler d1 execute midleton --remote --file ./seed-admin.sql
rm seed-admin.sql
```

デプロイ後、このアカウント（`info@alcogy.com` / 設定したパスワード）でログインする。必要に応じて `/database/accounts`（管理者専用）から追加のアカウントを作成する。

---

## 6. GitHub連携でWorkerを作成（初回デプロイ）

1. Cloudflareダッシュボード → **Workers & Pages** → **Create** → 「Gitリポジトリのインポート」を選択
2. GitHubアカウントを連携し、リポジトリ `alcogy/midleton` を選択
3. ビルド設定:
   - **Production branch**: `main`
   - **Build command**: `bun install && bun run build`
   - **Deploy command**: `bunx wrangler deploy`
   - **Root directory**: `/`
4. 「Save and Deploy」で初回デプロイを実行

> Wranglerのデフォルトのデプロイコマンドは `npx wrangler deploy` だが、本プロジェクトは Bun を使うため `bunx wrangler deploy` に変更する。`bun.lock` があるためビルドイメージはBunプロジェクトとして認識される。
>
> `bun run build` は `wrangler.build.jsonc`（アダプタ用設定）に従って `.svelte-kit/cloudflare/_worker.js` を生成し、続く `wrangler deploy` は `wrangler.toml`（`main = "worker.ts"`）に従ってそれをラップしたカスタムワーカー（Cron `scheduled` ハンドラ付き）をデプロイする。詳細は `CLAUDE.md` の「Worker エントリポイント」を参照。

---

## 7. 環境変数・Secretsの設定

Cloudflareダッシュボード → Workers & Pages → （6章で作成したWorker `midleton`）→ **Settings → Variables and Secrets** で設定する（ビルド用変数とは別の、ランタイム変数）。

`wrangler deploy` を実行すると `wrangler.toml` の `[vars]`（`ANTHROPIC_API_KEY`, `MOCK_AI`）以外のダッシュボード上の **plain変数は次回デプロイ時に消える可能性がある**ため、以下は全て **Secret** として設定する（値が非機密でも Secret 扱いで問題ない）。

| 変数名 | 必須 | 説明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ◯ | Claude APIキー（`wrangler.toml` の `[vars]` は空文字のままでよい） |
| `AI_MODEL` | - | 使用するClaudeモデルIDを上書きする場合のみ |
| `EMAIL_PROVIDER` | - | システムメール（リマインダー通知・パスワードリセット）を使う場合: `resend` / `ses` / `smtp` |
| `EMAIL_FROM` | △ | `EMAIL_PROVIDER` 設定時は必須。送信元アドレス |
| `EMAIL_FROM_NAME` | - | 送信元表示名 |
| `RESEND_API_KEY` | △ | `EMAIL_PROVIDER=resend` の場合に必須 |
| `SES_REGION` / `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` | △ | `EMAIL_PROVIDER=ses` の場合に必須 |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | △ | `EMAIL_PROVIDER=smtp` の場合に必須 |
| `SMTP_PORT` / `SMTP_SECURE` | - | SMTP使用時の任意設定（デフォルト `587` / `false`） |

メール送信を使わない場合（`EMAIL_PROVIDER` 未設定）、リマインダーの「メール」チャネルは送信失敗（`status: failed`）になるが、通知センター・Slackチャネルは影響なし。

`wrangler.toml` の `[vars]` の `MOCK_AI = "false"` はそのまま（本番でAIモック無効）。

---

## 8. デプロイ後の確認

- [ ] デプロイログでビルド・デプロイが成功している
- [ ] Cron Trigger（`* * * * *`、リマインダー配信）がダッシュボードの Triggers タブで有効
- [ ] `/signin` から手順5で投入したアカウントでログインできる
- [ ] `/settings/account` で表示名・パスワードを確認・変更できる
- [ ] メール送信を設定した場合、`/settings/email` の設定が反映されている
- [ ] 必要に応じて `/settings/integrations` で外部API連携（Slack通知等）を設定
- [ ] `/database/accounts` から必要なアカウントを追加

---

## 9. 継続的デプロイ・運用メモ

- `main` ブランチへのpushで自動的にビルド・デプロイされる。
- **D1マイグレーションは `wrangler deploy` に含まれない。** drizzleで新しいマイグレーションを追加した場合、デプロイ後に手動でリモートDBへ適用する:
  ```sh
  bunx wrangler d1 migrations apply midleton --remote
  ```
- 管理者がアカウントのパスワードを変更しても、既存セッションはKVのTTL（7日）失効まで有効（`docs/ROADMAP.md` v2 TODOの既知の制約）。
