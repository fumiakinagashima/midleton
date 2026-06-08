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

### テンプレート管理（`/templates`）
- [ ] テンプレート一覧・作成・編集・削除
- [ ] フォームテンプレートの定義 UI
- [ ] テンプレートを AI が選択できるように MCP ツールに追加


## フェーズ5：定期実行・品質向上

**目標：運用に耐える品質にする**

### 定期実行
- [ ] 実行可能オペレーションの定義（メール送信・データ集計・データ更新・APIコール）
- [ ] JSON スキーマによるバリデーション
- [ ] Cloudflare Queue への登録・実行
- [ ] AI によるノード設定サポート

### 品質・セキュリティ
- [ ] 認証・認可（ログイン・セッション管理）
- [ ] レート制限（AI API の過剰コール防止）
- [ ] エラーハンドリングの整備
- [ ] Cloudflare R2 へのファイル添付対応

### デモ準備
- [ ] デモ用シードデータ作成
- [ ] デモ動画撮影・X 投稿
- [ ] ランディングページ作成
