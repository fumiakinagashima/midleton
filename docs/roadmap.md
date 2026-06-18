# Midleton 開発ロードマップ

## v1（完了: 2026-06-15）

フェーズ1〜9のコア機能（チャットAI、MCPツール、データ管理・申請・アカウント管理、認証・権限、リマインダー・通知、資料生成、ノーコードアプリ生成）を実装済み。残課題は本ドキュメント末尾の「v2 TODO」を参照。

## フェーズ1：コアループの実証

**目標：チャット → Claude → MCP → DB → 動的UI の一連の流れを動かす**

### セットアップ
- [x] SvelteKit プロジェクト初期化
- [x] Cloudflare Wrangler 設定
- [x] Cloudflare D1 作成・接続確認
- [x] 環境変数管理（Claude API キー等）

### データ層
- [x] DrizzleORM 導入・D1 アダプタ設定
- [x] `customers` テーブル定義（Zod スキーマ含む）
- [x] マイグレーション実行

### MCP サーバー
- [x] MCP サーバー実装（Claude tool use API として SvelteKit サーバーサイドに実装）
- [x] ツール実装：`get_customers`（一覧取得）
- [x] ツール実装：`create_customer`（新規登録）
- [x] ツールのスキーマ定義（Claude が使えるように）

### Claude AI 連携
- [x] Anthropic SDK 導入
- [x] システムプロンプト設計（役割・UIコンポーネントの使い方・日本語指示）
- [x] ツールコール → MCP → DB の往復処理

### UIコンポーネント（最小限）
- [x] `Form` コンポーネント（フィールド定義を受け取って描画）
- [x] `Table` コンポーネント（カラム・データを受け取って描画）
- [x] `TypingIndicator` コンポーネント（ローディングアニメーション）
- [x] AI レスポンスのパーサー（テキスト / UI コンポーネント の切り分け）

### チャット UI
- [x] チャット画面のルーティング（`/`）
- [x] メッセージ送受信の UI
- [x] テキストメッセージのレンダリング
- [x] 動的コンポーネント（Form / Table）のレンダリング
- [x] フォーム送信 → API → DB 登録の流れ
- [x] メッセージのスライドインアニメーション・スムーズスクロール

### 確認ユースケース
- [x] 「顧客情報を登録したい」→ Form 生成 → 登録完了
- [x] 「顧客一覧を見せて」→ Table 表示


## フェーズ2：UIコンポーネントライブラリの整備

**目標：AIが使いやすいコンポーネント仕様を固め、デザインシステムの基盤を作る**

### コンポーネント設計
- [x] AI が返す UI 定義の JSON スキーマを設計（フォーム・テーブル・アクション）
- [x] Form コンポーネントの汎用化（テキスト・セレクト・日付・数値・テキストエリア等）
- [x] Table コンポーネントの汎用化（ソート・ページネーション対応）
- [x] チャット用 ActionSelector（TUI）コンポーネント
- [x] アプリUI コンポーネントライブラリ整備（Textbox, Textarea, Select, SearchSelect, Toggle, MultiSelect, SingleSelect, DatePicker, TimePicker, DateTimePicker, NumberInput, FileUpload, Table, Pagination, List, BarChart, LineChart, PieChart, DataGrid, TypingIndicator）
- [x] UIコンポーネントデモページ（`/ui`）・サイドバーリンク追加
- [x] README.md にコンポーネント仕様を記載

### デザインシステム
- [x] カラートークン・タイポグラフィの定義（CSS カスタムプロパティ）
- [x] 共通レイアウトコンポーネント（サイドバー付きシェルレイアウト）
- [x] ローディング・エラー状態の UI（TypingIndicator、エラー表示）
- [x] ダーク/ライト/システムテーマ切り替え

### システムプロンプトの改善
- [x] コンポーネント仕様をプロンプトに反映（form / table / actions UI 定義）


## フェーズ3：MCP ツールの拡張

**目標：CRM/SFA として必要なデータ操作を網羅する**

### DB設計方針（決定済み）
- **2層構成**: 固定コアテーブル（custom JSON カラム付き）＋ユーザー定義エンティティ（メタ＋JSON）
- コアテーブル: `customers` / `contacts` / `deals` / `activities`
- ユーザー定義: `entity_types` / `entity_fields` / `entities`

### スキーマ拡張
- [x] `contacts`（担当者）テーブル
- [x] `deals`（案件）テーブル
- [x] `activities`（活動履歴）テーブル
- [x] テーブル間のリレーション定義
- [x] `entity_types` / `entity_fields` / `entities`（ユーザー定義エンティティ）
- [x] `customers` に `custom` JSON カラム追加
- [x] Drizzle マイグレーション作成（`0001_phase3_schema.sql`）

### MCPツール追加
- [x] 更新系ツール（`update_customer`, `update_contact`, `update_deal`, `update_entity`）
- [x] 削除系ツール（`delete_customer`）
- [x] 検索・フィルタ系ツール（名前・ステータス・顧客ID等）
- [x] ユーザー定義エンティティ操作ツール（`list_entity_types`, `create_entity_type`, `add_entity_field`, `get_entities`, `create_entity`, `update_entity`）
- [x] 集計系ツール（`summarize_deals`, `summarize_customers`, `summarize_activities`）
- [x] 詳細取得ツール（`get_customer_detail`：顧客＋担当者＋案件＋活動をまとめて返す）
- [x] リレーション横断検索ツール（`search_customers`, `search_deals`, `search_activities`：IN サブクエリで関連エンティティをまたいで検索）
- [x] 外部API連携ツール（`list_integrations`, `call_external_api`）


## フェーズ4：設定・テンプレート画面

**目標：AIを介さない管理画面を整備する**

### 設定画面（`/settings`）
- [x] ルーティング・レイアウト
- [x] ユーザー設定（Enterで送信する、localStorage保存）
- [x] AI モデル選択・APIキー設定（localStorage保存、リクエスト時にサーバーへ渡す）

### 外部API連携設定（`/settings/integrations`）
- [x] API連携の追加・編集・削除 UI（`/settings/integrations`）
- [x] 接続情報をD1に保存（auth_config はJSONカラム、認証方式: none/api_key/bearer/basic）
- [x] MCPツール（`list_integrations`, `call_external_api`）でClaudeから任意の外部APIを呼び出せる仕組み

### チャット品質改善
- [x] AIレスポンスのマークダウンレンダリング（marked）
- [x] フォームの hidden フィールド対応（customer_id 等を透過的に送信）
- [x] Values コンポーネント（数値・通貨・日付をフォーマット表示、AI が生値を渡して誤転記を防ぐ）

### データ管理ページ（`/database`）
- [x] テーブル一覧（コアテーブル＋カスタムテーブル、件数表示）
- [x] レコード一覧（テーブル表示、詳細・編集・削除リンク）
- [x] レコード詳細（全フィールド＋システム項目をラベル付き表示）
- [x] レコード新規作成・編集フォーム（フィールド定義から動的生成）
- [x] カスタムテーブル新規作成（テーブル名・表示名・フィールド定義 UI）
- [x] カスタムテーブルスキーマ編集・削除（`/database/[type]/schema`）
- [x] コアテーブル（顧客・担当者・案件・活動履歴）のユーザー定義カラム管理（`core_custom_fields` テーブル、スキーマページ拡張）
- [x] スキーマ編集の動線を `/database/[type]` に統一（概要ページのリンク削除）
- [x] `recordSelect` フィールドタイプ追加（リレーション先テーブルを `SearchSelect` で検索選択、フォーム・詳細ページでラベル解決）
- [x] `contacts.customerId` を `recordSelect` 化（顧客名で検索選択）
- [x] レコード一覧ページの `recordSelect` フィールドもラベル解決（`/database/contacts` の「顧客」列をIDから顧客名表示に変更）
- [x] レコード詳細ページ：IDをカード先頭に表示
- [x] `customers` テーブル: `contactName` を廃止し `postalCode` / `website` を追加（migration 0011）
- [x] `contacts` テーブル: `department`（部署）を追加（migration 0011）
- [x] `contacts` テーブル: `nameKana`（氏名カナ）を `name` の直後に追加（migration 0012）


## フェーズ4（追加）：ガントチャート・申請管理・アカウント

### 案件ガントチャート
- [x] `deals` テーブルに `planned_start` / `planned_end` カラム追加（migration 0004）
- [x] `GanttChart.svelte` コンポーネント実装（4段階ズーム、ドラッグ移動・リサイズ、今日ライン、ステータス色分け）
- [x] 空行クリック＆ドラッグでバー生成（期間未設定案件への日程追加）
- [x] `/database/deals/gantt` ルート追加
- [x] チャットからガントチャート表示（`<ui type="gantt">` タグ対応）

### 申請管理
- [x] `approval_requests` テーブル（承認ルート・状況を JSON で一元管理、migration 0005）
- [x] `attachments` カラム追加（base64、1MBまで、migration 0006）
- [x] `/database/approvals` 一覧・詳細・新規作成 UI
- [x] 承認ルートステッパー UI（承認・否決ボタン、コメント入力）
- [x] MCP ツール（`list/get/create_approval`, `update_approval_step`, `cancel_approval`）
- [x] 並列承認は AND ロジック（同 step 番号の全員が承認で通過）

### アカウント管理
- [x] `accounts` テーブル（名前・役職・メール・権限・password_hash、migration 0007-0008）
- [x] 権限: `general | admin`
- [x] `/database/accounts` インライン編集 UI
- [x] 申請フォームの承認者選択をアカウント一覧から選べるように対応
- [x] テスト用アカウント5件投入済み（パスワード: `password`、SHA-256ハッシュ保存）

## フェーズ5：定期実行・品質向上

**目標：運用に耐える品質にする**

### インフラ・品質
- [x] 認証・認可（ログイン・セッション管理）
  - [x] ステップ1: ログイン画面・ログイン処理・セッション・サイドバーのログアウト
    - `src/lib/server/auth/password.ts`: パスワードハッシュの抽象化レイヤー（`hashPassword`/`verifyPassword`）。PBKDF2-SHA256（100,000回）で実装。既存のSHA-256仮ハッシュはログイン成功時に自動でPBKDF2へ移行（rehash）
    - `src/lib/server/auth/session.ts`: Cloudflare KVベースのセッション（`session:<id>` キー、7日TTL）
    - `src/hooks.server.ts`: 全ルートガード。未ログイン時は `/signin` 以外アクセス不可（APIは401 JSON、ページは303リダイレクト）。公開パスは `/signin` と `/api/auth/*`
    - `/signin` ページ、`/api/auth/signin`・`/api/auth/signout` エンドポイント、サイドバーのアカウント名表示・サインアウトボタン
    - [ ] TODO: 管理者がアカウントのパスワードを変更した際、該当ユーザーの既存セッションを即時破棄する仕組み（現状はKVのTTL失効まで有効なまま）
  - [x] ステップ2: 申請・リマインダー等の登録者アカウントIDをセッション情報から取得するように修正
    - 設計方針: `accountId = null` のレコード（ログイン実装前の既存データ）は全アカウント共通として表示・操作可能。新規作成分のみ `locals.account.id` を設定し、読み取りは `accountId IS NULL OR accountId = <自分>` でフィルタする
    - `activities.createdBy` / `dealRegisteredActivityInsert` / `recordActivity`: `env?.accountId` を設定
    - `reminders.accountId`: 手動登録（`/database/reminders`）・チャット経由（`create_reminder`）の両方で `locals.account.id` を設定。配信時（`delivery.ts`）は `accountId` から `getAccount` でメールアドレスを解決し、未設定時のみ `REMINDER_EMAIL_TO` にフォールバック
    - `notifications.accountId` / `chats.accountId`: 読み取り（`listNotifications`/`countUnreadNotifications`/`listChats`）にアカウントフィルタを追加。チャットのPATCH/DELETEは他アカウントのチャットを403で拒否
    - `approvalRequests.submittedBy`: クライアントからの入力を無視し、サーバー側で `locals.account.name` を設定（`submittedBy` の型自体は表示名文字列のまま、`accountId` FKへの置き換えは見送り）
    - 承認ステップの承認/否決ボタンは `!step.accountId || step.accountId === 自分のaccountId` の場合のみ表示
    - `ToolEnv`（`src/lib/server/mcp/handlers.ts`）に `accountId`/`accountName` を追加し、`dispatchTool` 経由でMCPツールへセッション情報を伝達
  - [x] ステップ3: 設定画面で自身のアカウント情報を編集できるようにする
    - `/settings/account`（プロフィール）ページを新設し、`/settings` 系ページのサブナビに追加
    - 基本情報（名前・メール・役職）を編集。`permission` は編集不可のバッジ表示（自己昇格防止）
    - 基本情報保存時は `PATCH /api/account`（`updateAccountSelfInputSchema`）。メール変更時は他アカウントとの重複を400で拒否。保存後 `invalidateAll()` でルートレイアウト（サイドバーの表示名）を再取得
    - パスワード変更は `PATCH /api/account/password`（`updateAccountPasswordInputSchema`）。現在のパスワードを `verifyPassword` で検証し、`hashPassword` で更新。`account-service.ts` に `getAccountWithPasswordById` を追加
    - 既存セッションの即時失効は対象外（ステップ1のTODOと同様、KVのTTL失効まで有効なまま）
  - [x] ステップ4: パスワードリセット画面・案内メール
    - `/signin` に「パスワードをお忘れですか？」リンクを追加し、`/signin/forgot-password`（メールアドレス送信）→ `/signin/reset-password?token=...`（新パスワード設定）の2画面を新設。両パスは `hooks.server.ts` の `PUBLIC_PATHS` に追加（未ログインでもアクセス可能）
    - リセットトークンは Cloudflare KV（`src/lib/server/auth/password-reset.ts`、`password-reset:<token>` キー、`{accountId}`、TTL1時間、使用後削除）。新規DBテーブルは不要
    - 案内メールはシステムメール（`getEmailSetupFromEnv`）を使用。`/settings/email` のDB設定・署名とは別物（リマインダーのメール通知と同じ位置付け）
    - `POST /api/auth/forgot-password`: アカウントの有無に関わらず常に `{ok:true}` を返す（enumeration対策）。アカウントが見つかった場合のみトークン発行・メール送信
    - `POST /api/auth/reset-password`: トークン検証 → `hashPassword` で更新 → トークン削除
    - レート制限: `src/lib/server/rate-limit.ts` の `checkRateLimit` を `(kv, scope, ip, opts?)` に汎用化（`scope` をキーに含め、`windowSeconds`/`maxRequests` を指定可能に）。既存のチャット系2箇所は `scope: 'chat'`（60秒/60回、デフォルト値）、forgot-passwordは `scope: 'forgot-password'`（1時間/5回）
  - [x] ステップ5: `permission: general | admin` によるルートガード実装（管理者専用ページ・操作の制限）
    - 対象: `/database/accounts`（アカウント管理）、`/settings/integrations`（外部API連携）、`/settings/email`（メール送信設定）と各バックエンドAPI（`/api/accounts*`, `/api/integrations*`, `/api/email/settings`）を admin 専用化。`/api/email/send`（`send_email` MCPツール、全ユーザーが利用）は対象外
    - `src/hooks.server.ts` に `ADMIN_ONLY_PREFIXES`（prefix方式）を追加し、`event.locals.account.permission !== 'admin'` の場合は `/api/*` は403（`errors.forbidden()`）、ページは `/` へ303リダイレクト
    - サイドバーの「アカウント」リンク、設定サブナビの「API連携」「メール」リンクは `data.account.permission === 'admin'` の場合のみ表示
- [x] レート制限（AI API の過剰コール防止）
  - Cloudflare KV ベースの固定ウィンドウ（60req/min/IP）
  - KV 未設定時は制限なしにフォールバック
  - `wrangler kv namespace create midleton` で KV 作成後、wrangler.toml に ID を設定する
- [x] エラーハンドリングの整備
  - `src/lib/server/errors.ts` に統一エラーレスポンスヘルパー
  - Toast コンポーネント（成功・エラー・情報）
- [x] Cloudflare R2 へのファイル添付対応
  - `/api/attachments` POST/GET/DELETE エンドポイント
  - 承認フォームからファイルを R2 にアップロード（最大10MB）
  - 旧 base64 形式との後方互換を維持
  - `wrangler r2 bucket create midleton` で R2 作成後、wrangler.toml を有効化する
- [x] メール送信基盤
  - [x] プロバイダー実装: Resend / AWS SES（SigV4）/ SMTP（cloudflare:sockets + STARTTLS）。設定は環境変数（`EMAIL_PROVIDER` 等、Cloudflare Secrets / `.dev.vars`）経由
  - [x] `/api/email/send` エンドポイント
  - [x] MCP ツール `send_email`（フェーズ7で追加。Claude が下書きフォーム経由で送信）
  - [x] `email_providers` テーブル・`/settings/email` 管理 UI（DB設定を優先し、未設定時は環境変数にフォールバック）
    - [x] 設定タブで SMTP / SES / Resend を切り替えて設定できるようにする
    - [x] 署名（フッター）設定を追加し、`send_email` 送信時に本文へ自動付与する
- [x] `/database` 配下全ページを `+page.server.ts` のSSR `load` 関数化し、ハイドレーション時の再フェッチによる画面ちらつきを解消
- [x] `/settings/integrations` など他の `onMount` フェッチ画面も同様にSSR `load` 化（チャットAI（`/`）以外は原則SSR、という方針に統一）


## フェーズ6：デモ強化・AI-first UX

**目標：ビジネスパートナー獲得に向け、派手さと説得力を優先した AI-first な体験にする**
**実装順: ① ストリーミング → ② チャット UI → ③ 新コンポーネント → ④ 名刺取り込み**

### ① ストリーミングレスポンス
- [x] `/api/chat` を SSE（Server-Sent Events）ストリーミングに変更
- [x] UI コンポーネント（Form / Table 等）はストリーム完了後に描画（SSE バッファリング＋一括描画）
- [x] ストリーミング中の中断・エラー処理

### ② チャット UI ブラッシュアップ
- [x] ユーザー / AI メッセージのレイアウト・デザイン刷新（claude.ai 風フローティング入力カード）
- [x] AI コンポーネントのフェードイン・スライドアニメーション（clip-path reveal / slideUp）
- [x] タイポグラフィ・余白・カラーの改善
- [x] 入力欄: 自動伸縮テキストエリア・Enter 送信切り替え・送信後にユーザーメッセージをビューの先頭へスクロール
- [x] フォーム送信・カメラでの名刺登録・新規メッセージ送信のいずれかをトリガーに、登録系UI（Form / Bizcard）をチャット上で非表示化（重複操作防止、Table/詳細リストは表示を維持）

### ③ 新 AI レスポンスコンポーネント
- [x] `Kanban` コンポーネント（商談ステージの横並びカンバン、ドラッグ&ドロップでステータス変更）
- [x] `Chart` コンポーネント（棒・折れ線・円グラフ、複数系列・積み上げ・グループ対応）
  - `BarChart`（ui/）: 単一・複数系列、grouped / stacked モード対応
  - `LineChart`（ui/）: 単一・複数系列、凡例表示対応
- [x] システムプロンプトに Kanban / Chart の仕様を追加（`src/lib/server/ai/prompt.ts`）

### ④ 名刺画像取り込み
- [x] `/bizcard` ページ実装（ドラッグ&ドロップ / ファイル選択、プレビュー表示）
- [x] `/api/bizcard` エンドポイント（multipart → base64 → Claude vision → JSON 抽出）
- [x] 複数枚同時対応（1枚の写真に複数名刺が写っていても全員分を配列で返す）
- [x] クライアント側リサイズ（Canvas API で長辺 1600px に縮小してから送信）
- [x] HEIC 形式の検出とエラー表示
- [x] タイムアウト処理（クライアント 25 秒 AbortController、SDK 20 秒）
- [x] 抽出結果から「顧客として登録」ボタンで `/database/customers/new` に pre-fill
- [x] チャット上に名刺スキャナーを直接表示（`bizcard` コンポーネント追加、`BizcardScanner` を `/bizcard` ページとチャットで共有、システムプロンプトに「名刺取り込み」意図のルールを追加）
- [x] チャット上の名刺読み取り結果から、別画面に遷移せずチャット内フォームで顧客・担当者登録（`create_customer_with_contact` MCPツール追加、「顧客・担当者を登録」「既存の顧客に担当者を追加」の2導線）
- [x] チャット名刺登録フォームの新規担当者フィールドに「部署」を追加（`contacts.department` と整合）
- [x] ~~ファイルアップロード（ドラッグ&ドロップ・ファイル選択・HEIC検出・クライアント側リサイズ）~~ → 2026-06-17 削除。カメラ撮影のみで十分と判断し撤去（下記⑤のOpenCV撤去と同時）

### ⑤ クイックアクション（AIを介さない定型操作）
- [x] 入力欄左下に「+」アイコンボタン → ポップアップメニュー（Gemini風、クリックで登録済みアクション一覧を表示）
- [x] `src/lib/quick-actions/catalog.ts`: 引数不要の一覧・集計系9ツール＋登録系2ツールの計11件のカタログ定義（顧客一覧・案件一覧・案件カンバン・担当者一覧・申請一覧・カスタムテーブル一覧・案件サマリ・顧客数サマリ・活動サマリ・顧客登録・名刺読取）
- [x] 案件カンバン: 列を案件ステータス（進行中・受注・失注）に対応させ、ドラッグ&ドロップで `PATCH /api/deals/[id]/status`（`update_deal` MCPツール経由）にステータスを保存。チャット上では Form/Bizcard と異なり通常操作では非表示化されず、再度「案件カンバン」が実行されたときのみ古いカンバンを非表示化
- [x] `src/lib/server/quick-actions/registry.ts`: 各ツールの実行結果を Table / Values / Chart に整形するレジストリ（顧客登録・名刺読取は `dispatchTool` を介さず Form / Bizcard UI を直接返す静的ハンドラ）
- [x] `/api/quick-actions` エンドポイント（AIを介さず `dispatchTool` を直接呼び出し、トークン消費なしで即時レスポンス）
- [x] `/settings/quick-actions`: 10件から最大5件を選択するチェックリストUI（localStorage に保存、設定変更がチャットの「+」メニューへ即時反映）
- [x] 案件サマリ・顧客数サマリ・活動サマリで `rows.reduce is not a function` が発生するバグを修正（`summarize_*` ツールの戻り値が配列でなく集計済みオブジェクトであることに対応）
- [x] Haiku vs Sonnet の精度比較・モデル選定（現状 Haiku、日本語名刺の精度は要検証）
- [x] Webカメラでの名刺スキャン機能（`CameraScanner.svelte`）。手動シャッター（Space キー対応）でフルフレームを撮影し `/api/bizcard` に送信
- [x] 連続スキャン対応（撮影後にカメラビューへ復帰、ストリーム再利用）
- [x] ~~OpenCV.js（`@techstark/opencv-js`）によるリアルタイム名刺枠検出・安定検出での自動撮影・透視変換補正~~ → 2026-06-17 削除。`await import('@techstark/opencv-js')` がVite/Rollupの本番ビルドでESM-interopスナップショットを作ってしまい`onRuntimeInitialized`が永久に発火せず、カメラ画面がフリーズするバグの調査過程で「自動シャッターは実運用でほぼ発火していなかった」「Claudeの読み取り精度はOpenCVの自動検出・補正なしでも十分」と判明したため撤去。10MB超のWASMバンドルも削減（クライアントバンドル 12MB+ → 800KB）

### ⑥ チャット履歴のサーバー永続化
- [x] D1に`chats`（id, title, accountId, createdAt, updatedAt）・`chat_messages`（id, chatId, role, contents, createdAt）テーブルを追加（1:N、`src/lib/server/db/chat-service.ts`）
- [x] メッセージ追加・フォーム/カンバンの完了状態変更・`document_job`→`link`解決のたびに`/api/chats/[id]/messages`へ非同期で永続化（upsert）
- [x] 最初のメッセージ送信時に切り詰めタイトルを即時表示し、`/api/chats/[id]/title`でAIが短いタイトルを生成してサイドバーを更新（`CHAT_TITLE_SYSTEM_PROMPT`, `generateChatTitle`）
- [x] `+page.server.ts`が`?id=<chatId>`をSSRで復元し、サイドバー履歴（`+layout.server.ts`の`listChats`）から会話を再開できる（今日/昨日/過去7日間/それ以前で分類、開いているチャットをハイライト）
- [x] サイドバー履歴項目の「…」メニューからタイトル変更（`PATCH /api/chats/[id]`）・チャット削除（`DELETE /api/chats/[id]`、物理削除）ができる


## フェーズ7：AI活用フェーズ（プロアクティブAI）

**目標：チャットでのCRUD中心の操作（UI置き換え）から、AIによる分析・提案・文章生成・レビューへ拡張する**

### AIメール下書き → 送信
- [x] `send_email` MCPツール追加（`to` / `subject` / `body` / `customer_id`、既存のメール送信基盤を呼び出し）
- [x] フォーム送信ボタンのラベルをツールごとに指定可能に（`submitLabel`、メールフォームは「送信」表示）
- [x] 送信成功時、`customer_id` 指定があれば活動履歴に「メール」種別で自動記録（`recordActivity`）
- [x] システムプロンプトにメール下書き作成フローを追加（顧客特定 → 下書き作成 → フォーム確認 → 送信）
- [x] 本文（`body`）の textarea の高さを現状の3倍程度に拡大する（`Form.svelte`、長文メールを編集しやすくする）

### 申請内容のAIレビュー
申請者向け（文章生成支援）と承認者向け（判断支援）の2種類のレビューを用意。
- [x] 【承認者向け／判断支援】`/api/approvals/[id]/ai-review` エンドポイント追加（承認待ちの申請をAIがレビューし、リスク・問題点・確認事項をJSONで返す）
- [x] システムプロンプトに承認申請レビュー専用プロンプトを追加（`APPROVAL_REVIEW_SYSTEM_PROMPT` / `buildApprovalReviewPrompt`、`src/lib/server/ai/prompt.ts`）
- [x] 添付ファイルが画像の場合はR2から取得しAIへ画像として渡す（5MBまで）
- [x] `/database/approvals/[id]` に「AIレビュー」セクションを追加（審査中の申請のみ表示、リスクレベル・総評・問題点・確認事項を表示）
- [x] 【申請者向け／文章生成支援】`/api/approvals/ai-review-draft` エンドポイント追加（提出前の下書きをAIがレビューし、誤字脱字・不足情報・改善提案をJSONで返す）
- [x] システムプロンプトに下書きレビュー専用プロンプトを追加（`APPROVAL_DRAFT_REVIEW_SYSTEM_PROMPT` / `buildApprovalDraftReviewPrompt`、`src/lib/server/ai/prompt.ts`）
- [x] `/database/approvals/new` に「AIレビュー」セクションを追加（提出前にタイトル・申請内容をレビュー、申請の作成・送信はブロックしない）

### 顧客ヘルススコア表示
- [x] `/api/customers/[id]/health-score` エンドポイント追加（案件・活動履歴からAIが取引関係の健全度をスコアリング、score・level・総評・良い兆候・懸念点をJSONで返す）
- [x] システムプロンプトに顧客ヘルススコア専用プロンプトを追加（`CUSTOMER_HEALTH_SCORE_SYSTEM_PROMPT` / `buildCustomerHealthScorePrompt`、`src/lib/server/ai/prompt.ts`）
- [x] `/database/customers/[id]` に「ヘルススコア」セクションを追加（スコア・評価バッジ・総評・良い兆候・懸念点を表示）
- [x] `customers` テーブルにスコアのキャッシュ列を追加（`health_score` / `health_score_level` / `health_score_summary` / `health_score_positives` / `health_score_concerns` / `health_score_updated_at`、マイグレーション `0015_customer_health_score.sql`）。再計算は手動操作時のみ行うlazy cache方式（定期実行なし）とし、計算結果をDBに保存・再利用する
- [x] 共有モジュール `src/lib/server/ai/customer-health.ts`（`getCachedCustomerHealthScore` / `computeCustomerHealthScore`）を追加し、`/api/customers/[id]/health-score` から利用するよう整理
- [x] チャットからの利用に対応: `get_customer_health_score`（名前/IDで個別スコアを取得、未計算時のみAI計算してキャッシュ）・`get_customer_health_ranking`（キャッシュ済みスコアをランキング表示、未計算件数を別途報告）の2 MCPツールを追加

### 顧客引き継ぎサマリー
担当者の変更・休暇引き継ぎ時に、顧客とのこれまでのやり取りをAIが要約し、注意点には参照元（案件・活動履歴）への別タブリンクを付ける機能。ヘルススコアと異なり都度生成のためDBキャッシュは行わない。
- [x] link コンポーネント（`MessageContent` の `link` 型、`parseUITag`、`Link.svelte`）に `newTab` オプションを追加し、`target="_blank" rel="noopener noreferrer"` で別タブを開けるように対応
- [x] システムプロンプトに引き継ぎサマリー専用プロンプトを追加（`CUSTOMER_HANDOVER_SUMMARY_SYSTEM_PROMPT` / `buildCustomerHandoverSummaryPrompt`、`src/lib/server/ai/prompt.ts`）。案件・活動履歴は全件をAIに渡し、注意点ごとに参照元レコードの `sourceType` / `sourceId` を出力させる
- [x] 共有モジュール `src/lib/server/ai/customer-handover.ts`（`computeCustomerHandoverSummary`）を追加。DBキャッシュは行わず毎回その場で生成する
- [x] `/api/customers/[id]/handover-summary` エンドポイント追加（要約・注意点をJSONで返す）
- [x] `/database/customers/[id]` に「引き継ぎサマリー」セクションを追加（要約・注意点と、各注意点から `/database/activities/{id}` または `/database/deals/{id}` への別タブリンクを表示）
- [x] チャットからの利用に対応: `get_customer_handover_summary`（名前/IDで指定、毎回AIが生成）MCPツールを追加。結果は地の文＋ `<ui type="link" newTab="true">` で参照元リンクを表示

### リマインダー機能
- [x] リマインダー機能（登録フロー）: クイックアクション「リマインダー設定」、またはチャットでの自然言語入力（例:「今日の14:50に会議のリマインダーをSlackに通知して」）から、日時・内容・通知先（通知センター／メール／Slack、複数選択可）を指定したフォームを表示し、`reminders` テーブルに登録する（`src/lib/server/db/reminder-service.ts`、`create_reminder` MCPツール）
  - メール・Slackは設定済みの場合のみ通知先の選択肢に表示する。Slackは `integrations` の `base_url` に `hooks.slack.com` を含む連携を検出し、表示ラベルはその連携の `name`、値は `slack:<integration_id>` とする（`src/lib/server/slack/index.ts`）
  - 「15:00の10分前」「〜ごろ」等の相対的・曖昧な時刻表現は、フォーム表示前に絶対時刻に変換して確認する（システムプロンプトに現在日時を動的注入: `buildSystemPrompt`）
  - 日付を指定せず時刻のみが指定された場合は、現在時刻との前後関係に関わらず本日の日付を使う
- [x] リマインダー画面（`/database/reminders`）: 登録フォーム（日時・通知先・内容）と、登録済みリマインダーの一覧（日時・内容・通知先（連携名に変換済み）・ステータス（未送信／送信済／失敗）、削除可）を表示する管理画面（`src/lib/server/db/reminder-service.ts` の `listReminders`/`createReminderRow`/`deleteReminder`/`getReminderChannelOptions`、`/api/reminders`、`/api/reminders/[id]`）
- [x] リマインダー配信: `reminders` テーブルの `pending` レコードを Cloudflare Cron Trigger で監視し、`remind_at` に達したら `channels`（通知センター／メール／Slack）へ実際に通知を送信する（送信後 `status` を `sent` / `failed` に更新）。配信ロジックは `src/lib/server/reminders/delivery.ts`（`processDueReminders`）。手動実行は `/api/reminders/run`（`/database/reminders` の「配信を実行」ボタン）、自動実行は Cron Trigger（`worker.ts` の `scheduled`、`wrangler.toml` の `[triggers]`、毎分実行）


## フェーズ8：AIによるノーコードアプリ生成

**目標：チャットで「〇〇管理アプリを作って」→ AIがデータモデルを提案・生成 → 既存の `/database/[type]` 汎用CRUD画面で即時運用できる体験を実現する**

既存の `entity_types` / `entity_fields` / `entities`（ユーザー定義エンティティ）と `/database/[type]` の汎用CRUD画面をそのまま活用し、新規アーキテクチャを増やさずに「アプリ生成」体験を組み立てる。

### v1: データモデル生成（CRUD）
- [x] チャットでの業務アプリ作成要求を認識するシステムプロンプト追加（entity_type・entity_fields構成案を提案）
- [x] 提案内容をtableコンポーネントでユーザーに確認・修正させるフロー（確定後、新規MCPツール `create_app` で entity_type・fields を一括作成）
- [x] 確定後、生成した `/database/[type]` への遷移リンク（link コンポーネント、newTab）を返す
- [x] サンプルデータの自動投入（`create_app` の `seed_records` で2〜3件登録、デモでの「即時運用感」向上）
- [x] 生成後の修正は既存のスキーマ編集UI（`/database/[type]/schema`）に誘導（システムプロンプトで案内）
- [x] 「関係」フィールド型（`recordSelect` + `refTable`）をカスタムテーブル（`entity_fields`）・コアテーブルのカスタムフィールド（`core_custom_fields`）に追加。`/database/[type]/schema` の FieldEditor で関連先テーブルを選択可能。`create_app` / `add_entity_field` の `ref_table` パラメータでAIが関係フィールドを生成できる（システムプロンプトに案内を追加）


## フェーズ9：AIによる資料生成

**目標：案件の進捗・売上情報やアプリ情報から、社内会議資料・提案資料をWord/Excel/PowerPointで生成し、ダウンロードリンクとして返す**

### v1: 生成基盤
- [x] R2バインディング有効化（`wrangler.toml`、本番デプロイ前に `wrangler r2 bucket create midleton` が必要）
- [x] `src/lib/server/documents/` モジュール追加（日本語フォント対応）
  - [x] `excel.ts`（exceljs、シート・列・行からxlsx生成）
  - [x] `word.ts`（docx、見出し・段落・表からdocx生成）
  - [x] `powerpoint.ts`（pptxgenjs、タイトル・本文・表からpptx生成）
  - [x] `storage.ts`（R2保存＋ダウンロードリンク生成、既存の `/api/attachments/[id]` を再利用）
- [x] Vitest で日本語コンテンツの出力検証（ZIP署名・jszip展開によるテキスト確認）
- [x] Cloudflare Workers向けバンドル確認（`wrangler deploy --dry-run` で `docx`/`exceljs`/`pptxgenjs` が `nodejs_compat` 下で正常にバンドルされることを確認）

### 機能実装
- [x] 社内会議資料の作成（案件の進捗・売上情報から自動生成するMCPツール追加）
  - [x] `create_word_document` / `create_excel_workbook` / `create_powerpoint_presentation` MCPツール追加（AIが既存の集計・検索ツールでデータを取得し、内容を構成して渡す汎用ツール。提案資料の作成にも利用できる）

### 非同期生成パイプライン
- [x] 完了通知の方式を段階的に検討
  - [x] ポーリング方式をプロトタイプ実装（KVにジョブ状態を保存し`platform.ctx.waitUntil`でバックグラウンド生成、`document_job` UIコンポーネントが`/api/documents/jobs/[id]`を2秒間隔でポーリング。Queue化前段の検証として動作確認済み）
  - [x] 通知センター（汎用）を追加する: 非同期ジョブ・通知は今後も増える想定のため、ポーリングカード（その場での即時表示用）に加えて永続的な通知の仕組みを用意する
    - [x] D1に`notifications`テーブル（type, title, body, seedContent, accountId, isRead, createdAt）を追加し、`create_word_document` / `create_excel_workbook` / `create_powerpoint_presentation` のジョブ完了・失敗時に記録する（`src/lib/server/db/notification-service.ts`）
    - [x] サイドバーに「通知」を追加し、左からスライドインするドロワーで一覧表示（タイトル＋本文冒頭40文字＋`...`、未読は太字＋ドット表示）。未読件数バッジを表示（99件超は`99+`）
    - [x] クリックすると新規チャット（`/?notification=<id>`）が開き、通知の`seedContent`（資料生成完了メッセージ＋ダウンロードリンク等）をシードにAIとの会話が始まり、そこから次の操作に繋げられる
    - [x] 未読件数バッジは`+layout.server.ts`のSSRロードで初期表示し、`/api/notifications/unread-count`を15秒間隔でポーリングして更新する（`src/routes/+layout.svelte`）
    - [x] チャット履歴のサーバー永続化（フェーズ6 ⑥で実装）後も、通知センターは「再訪時のエントリポイント」として併用する


## v2 TODO

v1リリース時点で未着手・保留となっている項目を集約する。優先度は未定。

### AI・チャット
- [x] AIが生成するフォームの必須フィールドの扱い・バリデーションルール
- [ ] **インライン回答UI（次の優先タスク）**
  AIが質問・選択肢を提示する際、チャット入力欄に文章で打ち返すのではなく、チャットメッセージ内にUIを直接表示して回答させる。
  - 単一選択: ラジオボタン or 選択ラベル（クリックで選択）
  - 複数選択: チェックボックス
  - 自由入力: テキスト / 数値入力欄
  - 回答確定ボタン（または選択と同時に送信）→ 回答内容をユーザーメッセージとしてチャットに追加し、AIが続きを処理
  - 新コンポーネント `Reply`（仮称）として `MessageContent` に追加し、システムプロンプトで使い方をAIに伝える
  - 既存の `ActionSelector`（TUIコンポーネント）は廃止または統合を検討
- [ ] サジェストプロンプトチップ（初期画面・入力欄）
- [ ] `Timeline` コンポーネント（活動履歴の時系列ビジュアル）— 要検討
- [ ] `Stats` / `Scorecard` コンポーネント（KPI 数値表示）— KPI 設定の設計が先
- [x] フォローアップ提案（案件・活動履歴から次のアクションをAIが提案）
- [ ] 議事録/メモ → 活動記録の自動生成（自由記述から activities への構造化登録）
- [x] ヘルプ（使い方・機能説明）をAIから呼び出せるようにする（MCPツール化）
- [ ] 利用状況（API利用状況・システム利用統計等）をAIから呼び出せるようにする（MCPツール化）

### 非AIページ

- [ ] 顧客詳細ページ（`/database/customers/[id]`）のUI整備: 基本情報・担当者・案件・活動履歴を一画面で確認できる専用レイアウト（現状は汎用の `[type]/[id]` ページ）

### 名刺画像取り込み
- [ ] 複数画像の一括アップロード対応（精度向上のため1枚ずつ処理する方式を検討中）
- [ ] チャット入力欄からの画像送信（チャット UI に統合する場合）
- [ ] 透視変換による高解像度トリミングで OCR 精度向上を確認（既存のフルサイズ画像方式との比較）

### 認証・セッション
- [ ] 管理者がアカウントのパスワードを変更した際、該当ユーザーの既存セッションを即時破棄する仕組み（現状はKVのTTL失効まで有効なまま。フェーズ5「認証・認可」ステップ1のTODO）

### テンプレート管理（`/templates`）
- [ ] テンプレート一覧・作成・編集・削除
- [ ] フォームテンプレートの定義 UI
- [ ] テンプレートを AI が選択できるように MCP ツールに追加

### ワークフロー生成・定期実行
一般的なノーコードツールでは「データモデル（CRUD）」と「トリガー→アクションのワークフロー」がセットで提供される。フェーズ8でアプリ生成（CRUD）は実装済みだが、ワークフローは未着手。

**Why:** ユーザーから、CRUD生成だけでは一般的なノーコードツールの体験に対して片手落ちという指摘。まずCRUD生成を作り、ワークフローは設計・実装をTODOとして残す（2026-06-12）。

v1はノードグラフ（キャンバス・ポート・x/y座標）で一度実装したが、汎用パラメータ・データフロー設計の難所に直面し設計をやり直した（`feature/workflow`ブランチを`main`から再作成、2026-06-17）。代わりにインデント付きステップリスト（トリガー→action/condition→…）+ ステップidによる結果参照（`@step:<id>`）方式を採用。

- [x] ワークフロー定義の構造設計: `WorkflowActionStep` / `WorkflowConditionStep`（`then`はYesのみ、elseは別ステップとして定義）、トリガーは毎日の時・分のみ（`src/lib/types/chat.ts`）
- [x] アクションツールのカタログ（`src/lib/workflow-tools.ts`）: v1は `send_email`（宛先は自動で自分）・`summarize_customers`（数値結果を条件で参照可能）の2種のみ
- [x] バリデーション（`src/lib/workflow-validation.ts`）: 必須パラメータ・条件のスカラー型チェック・ステップ参照の可視性（`then`内で作られた結果はその外から参照不可）
- [x] DB保存（`workflows`テーブル + マイグレーション`0022_workflows.sql`、`src/lib/server/db/workflow-service.ts`、MCP tools `save_workflow`/`list_workflows`、`/api/workflows`・`/api/workflows/[id]`）
- [x] 実行エンジン（`src/lib/server/workflow/run.ts`の`processDueWorkflows`）: 毎分のCron Trigger（`worker.ts`の`scheduled`）でJST時刻が一致する有効なワークフローを実行。未定義の変数参照時は即中断
- [x] ステップリスト編集UI（`src/lib/components/chat/Workflow.svelte` / `WorkflowStepList.svelte`、再帰的なインデント表示。キャンバス・ドラッグ&ドロップは廃止）
- [x] ワークフロー管理用の非AI画面（`/database/workflows`・`/new`・`/[id]`、有効化トグル）+ サイドバーリンク
- [x] AIによるワークフロー構成案の生成（チャット → `workflow`コンポーネントとしてステップ構成を提案、システムプロンプトに`@step:<id>`参照記法を案内）
- [x] **foreach（配列型の変数のみに適用、無限ループ回避のためwhileは提供しない）**: listResult（`search_customers`に追加）を持つ先行アクションの一覧を`@step:<id>`でforeachのsourceに指定し、body内では`@item:<field>`で現在の項目を参照する（`WorkflowForeachStep`、ループ本体専用スコープ。条件のthenと同じ可視性ルールで外からは参照不可）。暴走防止のため1回の実行で先頭から最大50件まで（`WORKFLOW_FOREACH_MAX_ITEMS`）。`WorkflowStepList.svelte`に「+ 繰り返し」追加、`@item:`はパラメータ・条件のセレクトから選択可能
- [x] AIレビュー機能: 編集中のワークフロー構成をAIがレビューし、未到達ステップ・条件の論理的な誤りなどを指摘する（`WORKFLOW_REVIEW_SYSTEM_PROMPT`/`buildWorkflowReviewPrompt`、`/api/workflows/review`、`WorkflowEditor.svelte`の「保存」横に配置。承認申請レビューと同じ「ボタン押下でAI分析」パターンを再利用）
- [x] ワークフロー作成画面専用のAIアシスタント（チャット）: `/database/workflows/new`・`/[id]`の左側に専用チャットパネル（`WorkflowChatPanel.svelte`）を設置し、会話内容に応じて右側のエディタへ直接ステップ構成を反映する（`Workflow.svelte`に`setState`を追加、`/api/workflow-chat`は読み取り専用ツールのみ許可）。メインチャットの汎用アシスタント（会話履歴・他ドメインの指示が混在）とは別に、ワークフロー構築に特化した単機能の対話とすることで精度を優先した
  - 副産物として、メインチャット側で`<ui type="workflow">`タグが`stream.ts`の`parseUITag`で未対応（他のタグ種別は実装済みだがworkflowのみ分岐が抜けていた）だったバグを発見・修正。チャットからのワークフロー提案機能はこれまで実質動作していなかった
- [x] ワークフローダイアログ（`WorkflowDialog.svelte`）: チャット内インライン表示（履歴に残り続け、後から内容が変わってもUIが追従しないため保存時に先祖帰りする恐れがあった）をやめ、`FormDialog`と同じ「チャット＋編集を左右に並べたモーダル」に統一。`/database/workflows`の「+ 新規作成」もページ遷移からこのダイアログに変更（保存後は一覧にその場で反映）。メインチャットで「ワークフローを作りたい」等の曖昧な依頼を受けた場合は、質問せず空のワークフローを即座にこのダイアログで表示する
- [x] `get_workflow` MCPツール（名前またはIDで既存ワークフローを取得。複数一致時は候補を提示）。`save_workflow`にもid引数を追加し、id指定時は新規作成ではなく更新するように修正（重複作成を防止）。メインチャットでの編集は上記ワークフローダイアログを再利用
- [x] アクションツールカタログの拡充（`WorkflowParamField`に`select`/`number`型を追加し、`search_customers`（件数）・`summarize_deals`・`summarize_activities`を追加。enumパラメータはセレクト、数値パラメータは`run.ts`実行時に数値変換してから`dispatchTool`へ渡す）
- [x] アクション選択を「カテゴリ→対象」の2段階に再編（`WORKFLOW_ACTION_CATEGORIES`、`WorkflowStepList.svelte`）。対象ごとにツールがフラットに増え続けるのを避ける狙い。カタログ本体（`WORKFLOW_ACTION_TOOLS`）は変更せず、その上に被せる表示用グルーピングなので保存データ（`step.tool`）への影響なし
  - 通知: 通知センター（`send_notification`）/ メール（`send_email`）
  - 検索・集計: 顧客 / 案件 / 活動履歴（`search_deals`・`search_activities`をカタログに追加し対称にした。`search_customers`と同様listResult付きでforeachのsourceにも使える）
  - [x] 担当者を検索・集計の両カテゴリに追加（`get_contacts`、listResult付き）。専用の集計（グループ集計）ツールが無いため`search_customers`と同じ「一覧→件数」パターンを採用し、同じツールを両カテゴリの対象に並べた。`get_contacts`は2カテゴリから参照されるため、保存済みステップを再読込した際のカテゴリ表示は常に「検索」になる（配列の並び順で先に一致した方を採用するため。機能的な差はなく見た目のみの制約）
  - [x] 自作テーブル: 「検索」カテゴリの対象に、顧客・案件・活動履歴と同じ並びで各カスタムテーブルが個別の選択肢として並ぶ（`includeEntityTargets`フラグ、`get_entities`固定。「自作テーブル」という1つの選択肢にまとめず、テーブルごとに対象を分けるUI）。テーブル一覧は画面アクセス時にサーバーサイドで取得する（`listEntityTypesForWorkflow`、`table-service.ts`）。対象選択時に`step.tool='get_entities'`と`step.params.entity_type_id`を直接設定し、`entity_type_id`はカタログのparamsには含めない（`send_email`の`to`注入と同じパターンで`run.ts`が直接付与する）
    - 保存済みの対象テーブルが後から削除された場合、編集画面では「（削除されたテーブル）」等の表示は持たせず単純に未選択（「対象を選択」）の状態に戻る設計どおり実装。`validateWorkflow`に`entityTypes`を渡して存在チェックを追加し、未選択（実質削除済み）はエラーとして保存をブロックする（全呼び出し元 — `WorkflowEditor`/`WorkflowDialog`/`save_workflow`/`/api/workflows`系API — でentityTypesを渡すように統一）
    - [x] foreachのsourceとしても利用可能（`get_entities`に`listResult`を追加。`extractList`が各レコードの`data`をトップレベルに展開するため、テーブルごとに異なるフィールドにも対応できる）。itemFieldsは選択中のentity_type_idから動的に解決する（`entityListItemFields`、`workflow-tools.ts`）。`collectListVisibility`/`validateWorkflow`/`WorkflowStepList.svelte`の3箇所で同じ解決ロジックを使用
  - Slack（通知）は対象の選択肢が連携設定に依存し動的に組み立てる必要があるため、別途仕組みを用意してから追加するTODOとして保留
- [ ] カスタムテーブル削除時にワークフローでの参照有無をチェックし、使用中なら削除前に警告する（別フェーズで対応）
- [x] 実行ログ・`workflow_runs`テーブル（マイグレーション`0023_workflow_runs.sql`、`src/lib/server/db/workflow-run-service.ts`）。`processDueWorkflows`が成功・失敗を問わず開始/終了時刻とエラーを記録し、`/database/workflows/[id]`に実行ログ一覧を表示する
- [x] アクション「通知センターに通知」（`send_notification` MCPツール、`communication.ts`）。宛先は自動でワークフロー登録者。cron実行時はセッションが無いため、`processDueWorkflows`で`workflow.accountId`をこの実行スコープの`env.accountId`として引き渡すように修正
- [ ] **変数ヘルプ（次の優先タスク）**: エディタ内で「今この位置で使える`@step:<id>`/`@item:<field>`」を動的に一覧確認できるUIが無く、各パラメータのselectを個別に開かないと分からない。ヘルプ的な一覧表示を検討する

### 資料生成
- [ ] 提案資料の作成（アプリ情報等を使ったWord/Excel/PowerPoint資料を生成するMCPツール追加）
- [ ] チャットからの呼び出しフロー・確認UX
- [ ] データ件数・資料の複雑度が増えた場合、現在の同期生成（チャット応答内でWorkerが生成→R2保存）はCPU時間制限（Cloudflare Workersは有料プランで30秒、`limits.cpu_ms`で5分まで延長可）に抵触する可能性がある
  - 対策: Queue（Cloudflare Queues。本番がAWSの場合はSQS+Lambdaでも同様の構成が可能）でジョブ化し、生成処理をチャット応答から切り出す（フロー: チャットからジョブ登録 → Queueコンシューマが生成 → R2保存 → 完了通知）。Queue化後も同じ`document_job`通知パターン（ポーリングカード）を再利用する想定
- [ ] 通知センターの未読件数ポーリング（15秒間隔 ×セッション数）はセッション数が増えるとD1リクエスト数が線形に増加する。負荷・コストが問題になる場合はWebSocket/Durable Objects等のプッシュ型への移行や、間隔の動的調整、複数タブでのリクエスト共有などを検討する

### モバイル対応
- [ ] モバイル対応方針の決定（レスポンシブ CSS vs user-agent 判定でスマホ専用ビュー）
  - レスポンシブ: メディアクエリで同一コンポーネントをスマホ幅に対応させる（サイドバー → ハンバーガーメニュー等）
  - user-agent 判定: SvelteKit hooks でスマホを検知し、モバイル専用レイアウト・ルートに振り分ける
  - 主な対応箇所: `+layout.svelte`（サイドバー）、`+page.svelte`（チャット余白）、データ管理・設定ページのグリッドレイアウト
- [ ] 決定した方針で実装

### デモ・リリース準備
- [ ] デモ用シードデータ作成
- [ ] デモ動画撮影・X 投稿
- [ ] ランディングページ作成
