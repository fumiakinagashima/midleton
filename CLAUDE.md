# Midleton

AIファーストなチャットベースの CRM/SFA。
SvelteKit + Claude AI + MCP サーバー構成。ユーザーはチャットで業務指示を出し、AIが動的にフォームやテーブルを生成して操作を完結させる。

## 技術スタック

- **パッケージマネージャー**: Bun
- **フロントエンド**: SvelteKit, TypeScript
- **バリデーション**: Zod
- **ORM**: DrizzleORM
- **インフラ**: Cloudflare (Wrangler, D1, R2, KV, Queue)
- **AI**: Claude API (Anthropic)
- **プロトコル**: MCP (Model Context Protocol)
- **テスト**: Vitest（ユニット, `bun run test:unit`）, Playwright（E2E, `bun run test:e2e`、`e2e/` 配下）

## ディレクトリ構成

```
midleton/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte    # サイドバー・テーマ切り替え
│   │   ├── +page.svelte      # チャット画面（/）
│   │   ├── ui/               # UIコンポーネントデモ（/ui）
│   │   ├── bizcard/          # 名刺取り込み（/bizcard）
│   │   ├── settings/         # 設定画面（/settings, /settings/integrations, /settings/quick-actions, /settings/email）
│   │   ├── database/         # データ管理画面（/database, /database/[type], /database/[type]/[id] 等）
│   │   └── api/
│   │       ├── chat/         # チャット API エンドポイント
│   │       ├── bizcard/      # 名刺画像 → Claude vision → JSON 抽出
│   │       ├── integrations/ # 外部API連携 CRUD エンドポイント
│   │       ├── quick-actions/# クイックアクション実行 API（AIを介さず dispatchTool を直接呼び出し）
│   │       └── database/     # データ管理 REST API（tables, records CRUD）
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/       # アプリUIコンポーネント（デザインシステム: Textbox, Select, Table, DataGrid, BarChart, LineChart 等）
│   │   │   │               BarChart / LineChart は単一・複数系列（grouped / stacked）に対応
│   │   │   ├── chat/     # AIがノーコードとして返すコンポーネント（Form, Table, ActionSelector, Values, Gantt, Chart, Kanban, Link, Bizcard）
│   │   │   ├── database/ # データ管理専用コンポーネント（RecordForm, FieldEditor）
│   │   │   └── bizcard/  # 名刺スキャン専用コンポーネント（CameraScanner, cardDetector）
│   │   ├── quick-actions/ # クイックアクションのカタログ定義（クライアント・サーバー共有、catalog.ts）
│   │   ├── server/       # サーバーサイドロジック
│   │   │   ├── db/       # DrizzleORM スキーマ・クエリ（schema.ts, table-service.ts）
│   │   │   ├── mcp/      # MCPサーバー・ツール定義
│   │   │   ├── ai/       # Claude API 連携・システムプロンプト・モック
│   │   │   ├── documents/ # Word/Excel/PowerPoint生成（docx, exceljs, pptxgenjs、日本語フォント対応）・R2保存とダウンロードリンク生成
│   │   │   └── quick-actions/ # クイックアクションのツール実行・結果整形レジストリ（registry.ts）
│   │   ├── styles/       # グローバルスタイル・テーマ定義
│   │   └── types/        # 共通型定義
│   └── app.html
├── messages/             # i18n リソース（ja.json）
├── drizzle/              # マイグレーションファイル
├── drizzle.local.config.ts  # ローカル D1 SQLite 向け Drizzle Studio 設定
├── docs/
│   └── ROADMAP.md
├── worker.ts             # Cloudflare Workers エントリポイント（wrangler.toml の main）
├── wrangler.toml         # 本番用設定（bindings, [triggers] 等）
├── wrangler.build.jsonc  # ビルド時のみ使用するアダプタ向け設定
└── CLAUDE.md
```

## 仕様

### i18n
- 将来の多言語対応を考慮し、表示文字列はすべて i18n リソースから参照する
- デフォルト言語は日本語（`ja`）
- ライブラリは `paraglide-js`（`@inlang/paraglide-sveltekit`）を使用
- メッセージファイルは `messages/` ディレクトリで管理

### テーマ
- ダークモード・ライトモード・システム（OS 設定に追従）の3択
- CSS カスタムプロパティ（`--color-*` 等）でトークンを定義し、`data-theme` 属性で切り替える
- ユーザー設定は `localStorage` に保存する
- システムは `prefers-color-scheme` メディアクエリに追従する

## 非AIページの方針

チャット中心の設計だが、すべての操作を AI 経由にする必要はない。  
定型的な CRUD や設定はノーAI の管理画面を用意し、APIコスト削減・操作性向上を両立する。

- `/database` — データ管理（コアテーブル＋カスタムテーブルの CRUD、スキーマ定義）
- `/database/approvals` — 申請管理（承認ルート・ステップ操作）
- `/database/accounts` — アカウント管理（権限・パスワード）
- `/database/reminders` — リマインダー管理（登録フォーム・一覧・削除。チャット／クイックアクションからも登録可能）
- `/settings` — アプリ設定・外部API連携管理
- `/settings/quick-actions` — チャット入力欄の「+」ボタンに表示するクイックアクション（最大5件）の選択

### AI分析セクションのパターン

ノーAIページ（`/database/customers/[id]` 等）に「ボタン押下でAIが分析結果を生成・表示する」セクションを追加するパターン（例: ヘルススコア、引き継ぎサマリー）。

- ランキング表示など再利用が必要な場合 → `customers` テーブル等に結果をキャッシュする専用カラムを追加し、再計算は手動操作時のみ行う（lazy cache、定期実行なし）。例: ヘルススコア（`health_score*` カラム）
- 単発・都度確認用の場合 → キャッシュせず毎回その場でAIが生成する。例: 引き継ぎサマリー
- いずれも `src/lib/server/ai/` に共有計算モジュールを置き、`/api/customers/[id]/...` エンドポイントと MCP ツールの両方から呼び出す（例: `customer-health.ts` / `customer-handover.ts`）

## クイックアクション

チャット入力欄の「+」ボタンから、引数不要の一覧・集計系 MCP ツールを AI を介さず直接実行できる（`/api/quick-actions`）。レスポンスは `dispatchTool` の結果を Table / Values / Chart 等に整形して即時返却し、トークンを消費しない。

- カタログ定義: `src/lib/quick-actions/catalog.ts`（クライアント・サーバー共有）
- 実行・整形ロジック: `src/lib/server/quick-actions/registry.ts`
- ユーザーは `/settings/quick-actions` で全候補から最大5件を選択（localStorage に保存）
- 新しいツールを候補に追加する場合は、引数不要の一覧・集計系であることを確認した上で `catalog.ts` と `registry.ts` の両方に追加する
- 例外として、顧客登録（`create_customer`）・名刺読取（`scan_bizcard`）・リマインダー設定（`create_reminder`）は登録系だが追加済み。`create_customer`/`scan_bizcard` は `dispatchTool` を呼ばず、`registry.ts` の静的ハンドラ（`StaticQuickActionHandler`）として `form` / `bizcard` の `MessageContent` を直接返す。`create_reminder` はDB参照結果（設定済み連携など）に応じてフォーム内容を動的に組み立てる必要があるため、`DynamicQuickActionHandler`（`build(db, env?)`）として実装する（実際のツール呼び出しはユーザーがフォーム送信した時点で発生）
- Slack連携の検出: `integrations` テーブルの `base_url` に `hooks.slack.com` を含むレコードを Slack Incoming Webhook 連携として扱う（`src/lib/server/slack/index.ts`）。通知先選択肢のラベルにはその連携の `name`、値には `slack:<integration_id>` を使う

## リマインダー配信

`reminders` テーブルの `pending` レコードを監視し、`remind_at` に達したものを `channels`（通知センター／メール／Slack）へ送信する（`src/lib/server/reminders/delivery.ts` の `processDueReminders`）。送信後 `status` を `sent` / `failed` に更新する。

- 手動実行: `/api/reminders/run`（`/database/reminders` の「配信を実行」ボタン）
- 自動実行: Cloudflare Cron Trigger（`wrangler.toml` の `[triggers]`、毎分実行）。ハンドラは `worker.ts` の `scheduled`
- `channels` が `email` の場合は「システムメール」（環境変数 `EMAIL_PROVIDER` 等、`getEmailSetupFromEnv`）を使う。`/settings/email`・`send_email` MCPツールが使う DB設定（`getEmailSetup`、署名付き）とは別物
  - 送信先は `reminders.accountId` から `getAccount` で取得したアカウントの `email`。`accountId` が `null`（ログイン実装前の既存データ）または該当アカウントに `email` が未設定の場合は `delivery.ts` の `REMINDER_EMAIL_TO`（テスト用固定アドレス）にフォールバックする

### Worker エントリポイント（Cron Trigger 対応）

`@sveltejs/adapter-cloudflare` が生成する `_worker.js` は `fetch` のみで `scheduled` をエクスポートできないため、独自のラッパーを `main` に指定している。

- `worker.ts`（プロジェクトルート）: SvelteKit生成の `fetch` をラップし、`scheduled` を追加。`src/` 外に置くことで `bun run check`（svelte-check）の対象から外し、ビルド前に存在しない生成物 `.svelte-kit/cloudflare/_worker.js` への依存による型エラーを避けている
- `wrangler.build.jsonc`: アダプタのビルド時専用設定。`main`/`assets` をデフォルトの `.svelte-kit/cloudflare/_worker.js` に向け、アダプタがそこへ生成物を書き出すようにする（`svelte.config.js` の `adapter({ config: 'wrangler.build.jsonc', ... })`）
- `wrangler.toml`: 実際の `wrangler dev` / `deploy` 用設定。`main = "worker.ts"`、bindings、`[triggers]` を定義
- ビルド（`bun run build`）→ `wrangler dev` / `deploy` の順で実行する（`worker.ts` が `.svelte-kit/cloudflare/_worker.js` を相対importするため、先にビルドが必要）

## 認証

フェーズ5ステップ1でログイン・セッション・全面ルートガードを実装済み、ステップ2で登録者の `accountId`/`submittedBy` をセッション情報から設定するように変更済み（ステップ3以降は `docs/ROADMAP.md` 参照）。

- 登録者アカウントIDの扱い: `activities.createdBy` / `reminders.accountId` / `notifications.accountId` / `chats.accountId` / `approvalRequests.route[].accountId` は新規作成時に `locals.account.id` を設定する。`accountId = null`（ログイン実装前の既存データ）は全アカウント共通として扱われ続け、読み取りフィルタは `accountId IS NULL OR accountId = <自分>`、承認ステップの操作可否は `!step.accountId || step.accountId === <自分>` で判定する。`approvalRequests.submittedBy` は表示名文字列のまま、値はサーバー側で `locals.account.name` を設定する

- パスワードハッシュ: `src/lib/server/auth/password.ts` に抽象化レイヤー（`hashPassword`/`verifyPassword`）を置き、PBKDF2-SHA256（100,000イテレーション、フォーマット `pbkdf2:<iterations>:<saltBase64>:<hashBase64>`）で実装。将来別方式（bcrypt/argon2/AWS等）へ移行する場合はこのファイル内に閉じる
  - 既存のSHA-256仮ハッシュ（64文字hex）はログイン成功時に自動でPBKDF2へ移行（rehash）される
  - テスト用アカウント5件・自身のアカウント（`info@alcogy.com`）のパスワードはすべて `password`
- セッション: Cloudflare KV（`session:<sessionId>` キー、`{ accountId }` をJSON保存、7日TTL）。`src/lib/server/auth/session.ts`
  - TODO: 管理者がアカウントのパスワードを変更した際、該当ユーザーの既存セッションを即時破棄する仕組み（現状はKVのTTL失効まで有効なまま）
- ルートガード: `src/hooks.server.ts` の `handle` で全ルートを保護。公開パスは `/signin` と `/api/auth/*` のみ
  - 未ログインで `/api/*` へアクセス → 401 JSON（`{ error, code: 'UNAUTHORIZED' }`）
  - 未ログインでページへアクセス → `/signin?redirect=<元のパス>` へ303リダイレクト
  - ログイン済みで `/signin` へアクセス → `/` へ303リダイレクト
- `event.locals.account`（`AccountRow`、`passwordHash` は含まない）をSSR `load` ・APIエンドポイントから参照する
- ルートレイアウト（`+layout.svelte`）は `data.account` が `null`（`/signin` のみ到達可能）の場合サイドバーを描画しない

## Git ルール

- コミットメッセージは英語で記載する
- Co-Authored-By 等の共同作業者表記は付けない
- **コミットはユーザーからの明示的な指示があるまで行わない**（実装確認後にコミット）
- 作業完了時は `docs/ROADMAP.md` の該当タスクをチェックし、仕様変更があれば `CLAUDE.md` も更新する

## 開発ルール

- UIコンポーネントは `src/lib/components/` に集約する。アプリUI（デザインシステム）は `ui/`、AIがノーコードとしてレスポンスに返すコンポーネント（Form, Table, Values 等）は `chat/`、データ管理ページ専用コンポーネント（RecordForm, FieldEditor）は `database/` に配置する。AIが参照するコンポーネント仕様はシステムプロンプトで管理する。
- chat の `link` コンポーネントは `newTab="true"` 属性で別タブ表示（`target="_blank" rel="noopener noreferrer"`）に対応する。参照元レコードへのリンクなど、チャットの会話を中断させたくない場合に使う。
- DBスキーマ変更は必ず Drizzle マイグレーションを通す。直接 D1 を操作しない。将来のインフラ移行を考慮し、D1 固有 API への直接依存を避ける（DrizzleORM 経由を徹底）。
- 複数テーブル・複数レコードを同時に更新（登録・編集・削除）する場合は `db.batch([...])` で原子的に実行する。DrizzleORM の D1 ドライバの `db.transaction()`（BEGIN/COMMIT）はローカル（Miniflare）では動くが本番の D1 ではエラーになるため使用しない。`batch()` は実行前にクエリを全て組み立てる必要があり、前段の結果を読んで後続クエリの内容を分岐するような処理には使えない点に注意する。
- MCP ツールは `src/lib/server/mcp/` に定義し、Zod でスキーマを検証する。Zod スキーマの命名は camelCase + `Schema` サフィックス（例: `createCustomerInputSchema`）。
- 秘匿情報（API キー等）は Cloudflare の環境変数または KV に保存する。コードに埋め込まない。
- MCP ツールが Cloudflare の環境変数・シークレット（`platform.env`）を必要とする場合は、`dispatchTool` の任意引数 `env` 経由で渡す（例: `send_email`）。
- AIへのシステムプロンプトは `src/lib/server/ai/` で一元管理する。
- テキスト入力で Enter キー押下時に送信・確定などのアクションを行う場合、日本語入力の変換確定Enterで誤発火しないよう `keydown` ハンドラで `event.isComposing` が `true` の場合は処理しない（チャット入力欄の `handleKey`、サイドバー履歴のリネーム入力 `handleRenameKeydown` を参照）。

## ロードマップ

`docs/ROADMAP.md` を参照。

## 参考

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [DrizzleORM](https://orm.drizzle.team/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
- [Anthropic API](https://docs.anthropic.com/)
