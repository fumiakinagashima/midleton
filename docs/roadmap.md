# Midleton 開発ロードマップ

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
- [ ] ストリーミングレスポンス実装（将来対応）
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
- [ ] 必須フィールドの扱い・バリデーションルール


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

### ユースケース追加
- [ ] 「今月完了した案件一覧」→ Table 表示
- [ ] 「この顧客の活動履歴を見せて」→ Timeline 表示
- [ ] 「在庫管理テーブルを作って」→ ユーザー定義エンティティ作成


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

### テンプレート管理（`/templates`）
- [ ] テンプレート一覧・作成・編集・削除
- [ ] フォームテンプレートの定義 UI
- [ ] テンプレートを AI が選択できるように MCP ツールに追加


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

### 定期実行
- [ ] 実行可能オペレーションの定義（メール送信・データ集計・データ更新・APIコール）
- [ ] JSON スキーマによるバリデーション
- [ ] Cloudflare Queue への登録・実行
- [ ] AI によるノード設定サポート

### インフラ・品質
- [ ] 認証・認可（ログイン・セッション管理）
  - `accounts` テーブル・`password_hash` カラムは実装済み（migration 0007-0008）
  - 現状の `password_hash` は SHA-256（仮）→ 本実装時に bcrypt/argon2 に移行すること
  - セッション管理は Cloudflare KV or D1 で実装予定
  - `permission: general | admin` によるルートガード実装
  - `submittedBy` を `accountId` FK に置き換えることも検討
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
  - `email_providers` テーブル（migration 0009）
  - プロバイダー: Resend / AWS SES（SigV4）/ SMTP（cloudflare:sockets + STARTTLS）
  - `/settings/email` 管理 UI（プロバイダー追加・有効化・テスト送信）
  - MCP ツール `send_email`（Claude からメール送信）
  - `/api/email/send` エンドポイント

### モバイル対応
- [ ] モバイル対応方針の決定（レスポンシブ CSS vs user-agent 判定でスマホ専用ビュー）
  - レスポンシブ: メディアクエリで同一コンポーネントをスマホ幅に対応させる（サイドバー → ハンバーガーメニュー等）
  - user-agent 判定: SvelteKit hooks でスマホを検知し、モバイル専用レイアウト・ルートに振り分ける
  - 主な対応箇所: `+layout.svelte`（サイドバー）、`+page.svelte`（チャット余白）、データ管理・設定ページのグリッドレイアウト
- [ ] 決定した方針で実装

### デモ準備
- [ ] デモ用シードデータ作成
- [ ] デモ動画撮影・X 投稿
- [ ] ランディングページ作成


## フェーズ6：デモ強化・AI-first UX

**目標：ビジネスパートナー獲得に向け、派手さと説得力を優先した AI-first な体験にする**
**実装順: ① ストリーミング → ② チャット UI → ③ 新コンポーネント → ④ 名刺取り込み**

### ① ストリーミングレスポンス
- [x] `/api/chat` を SSE（Server-Sent Events）ストリーミングに変更
- [x] UI コンポーネント（Form / Table 等）はストリーム完了後に描画（SSE バッファリング＋一括描画）
- [x] ストリーミング中の中断・エラー処理
- [ ] フロントでテキストをトークン単位でタイプライター表示（現状は受信完了後に clip-path アニメーションで表示）

### ② チャット UI ブラッシュアップ
- [x] ユーザー / AI メッセージのレイアウト・デザイン刷新（claude.ai 風フローティング入力カード）
- [x] AI コンポーネントのフェードイン・スライドアニメーション（clip-path reveal / slideUp）
- [x] タイポグラフィ・余白・カラーの改善
- [x] 入力欄: 自動伸縮テキストエリア・Enter 送信切り替え・送信後にユーザーメッセージをビューの先頭へスクロール
- [ ] サジェストプロンプトチップ（初期画面・入力欄）

### ③ 新 AI レスポンスコンポーネント
- [x] `Kanban` コンポーネント（商談ステージの横並びカンバン、ドラッグ&ドロップでステータス変更）
- [x] `Chart` コンポーネント（棒・折れ線・円グラフ、複数系列・積み上げ・グループ対応）
  - `BarChart`（ui/）: 単一・複数系列、grouped / stacked モード対応
  - `LineChart`（ui/）: 単一・複数系列、凡例表示対応
- [x] システムプロンプトに Kanban / Chart の仕様を追加（`src/lib/server/ai/prompt.ts`）
- [ ] `Timeline` コンポーネント（活動履歴の時系列ビジュアル）— 要検討
- [ ] `Stats` / `Scorecard` コンポーネント（KPI 数値表示）— KPI 設定の設計が先
- [ ] デモ用ユースケース確認（「今月の商談状況は？」→ Kanban + Chart）

### ④ 名刺画像取り込み
- [x] `/bizcard` ページ実装（ドラッグ&ドロップ / ファイル選択、プレビュー表示）
- [x] `/api/bizcard` エンドポイント（multipart → base64 → Claude vision → JSON 抽出）
- [x] 複数枚同時対応（1枚の写真に複数名刺が写っていても全員分を配列で返す）
- [x] クライアント側リサイズ（Canvas API で長辺 1600px に縮小してから送信）
- [x] HEIC 形式の検出とエラー表示
- [x] タイムアウト処理（クライアント 25 秒 AbortController、SDK 20 秒）
- [x] 抽出結果から「顧客として登録」ボタンで `/database/customers/new` に pre-fill
- [ ] 複数画像の一括アップロード対応（精度向上のため1枚ずつ処理する方式を検討中）
- [ ] Haiku vs Sonnet の精度比較・モデル選定（現状 Haiku、日本語名刺の精度は要検証）
- [ ] チャット入力欄からの画像送信（チャット UI に統合する場合）
