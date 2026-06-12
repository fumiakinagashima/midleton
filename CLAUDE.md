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
│   │   │   └── quick-actions/ # クイックアクションのツール実行・結果整形レジストリ（registry.ts）
│   │   ├── styles/       # グローバルスタイル・テーマ定義
│   │   └── types/        # 共通型定義
│   └── app.html
├── messages/             # i18n リソース（ja.json）
├── drizzle/              # マイグレーションファイル
├── drizzle.local.config.ts  # ローカル D1 SQLite 向け Drizzle Studio 設定
├── docs/
│   └── ROADMAP.md
├── wrangler.toml
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
- `/settings` — アプリ設定・外部API連携管理
- `/settings/quick-actions` — チャット入力欄の「+」ボタンに表示するクイックアクション（最大5件）の選択

## クイックアクション

チャット入力欄の「+」ボタンから、引数不要の一覧・集計系 MCP ツールを AI を介さず直接実行できる（`/api/quick-actions`）。レスポンスは `dispatchTool` の結果を Table / Values / Chart 等に整形して即時返却し、トークンを消費しない。

- カタログ定義: `src/lib/quick-actions/catalog.ts`（クライアント・サーバー共有）
- 実行・整形ロジック: `src/lib/server/quick-actions/registry.ts`
- ユーザーは `/settings/quick-actions` で全候補から最大5件を選択（localStorage に保存）
- 新しいツールを候補に追加する場合は、引数不要の一覧・集計系であることを確認した上で `catalog.ts` と `registry.ts` の両方に追加する
- 例外として、顧客登録（`create_customer`）・名刺読取（`scan_bizcard`）は登録系だが追加済み。これらは `dispatchTool` を呼ばず、`registry.ts` の静的ハンドラ（`StaticQuickActionHandler`）として `form` / `bizcard` の `MessageContent` を直接返す（実際のツール呼び出しはユーザーがフォーム送信した時点で発生）

## 認証（フェーズ5で実装予定）

- `accounts` テーブルに `permission`（`general | admin`）・`password_hash` を実装済み
- 現状の `password_hash` は SHA-256（仮）。本実装時は **bcrypt または argon2 に移行**すること
- テスト用アカウント5件のパスワードはすべて `password`
- セッション管理は Cloudflare KV または D1 で実装予定
- 認証実装までは全ルートが未保護。フェーズ5で SvelteKit hooks（`handle`）でガードする

## Git ルール

- コミットメッセージは英語で記載する
- Co-Authored-By 等の共同作業者表記は付けない
- **コミットはユーザーからの明示的な指示があるまで行わない**（実装確認後にコミット）
- 作業完了時は `docs/ROADMAP.md` の該当タスクをチェックし、仕様変更があれば `CLAUDE.md` も更新する

## 開発ルール

- UIコンポーネントは `src/lib/components/` に集約する。アプリUI（デザインシステム）は `ui/`、AIがノーコードとしてレスポンスに返すコンポーネント（Form, Table, Values 等）は `chat/`、データ管理ページ専用コンポーネント（RecordForm, FieldEditor）は `database/` に配置する。AIが参照するコンポーネント仕様はシステムプロンプトで管理する。
- DBスキーマ変更は必ず Drizzle マイグレーションを通す。直接 D1 を操作しない。将来のインフラ移行を考慮し、D1 固有 API への直接依存を避ける（DrizzleORM 経由を徹底）。
- MCP ツールは `src/lib/server/mcp/` に定義し、Zod でスキーマを検証する。Zod スキーマの命名は camelCase + `Schema` サフィックス（例: `createCustomerInputSchema`）。
- 秘匿情報（API キー等）は Cloudflare の環境変数または KV に保存する。コードに埋め込まない。
- MCP ツールが Cloudflare の環境変数・シークレット（`platform.env`）を必要とする場合は、`dispatchTool` の任意引数 `env` 経由で渡す（例: `send_email`）。
- AIへのシステムプロンプトは `src/lib/server/ai/` で一元管理する。

## ロードマップ

`docs/ROADMAP.md` を参照。

## 参考

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [DrizzleORM](https://orm.drizzle.team/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
- [Anthropic API](https://docs.anthropic.com/)
