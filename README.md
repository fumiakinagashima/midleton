# Midleton

AIファーストなチャットベースの CRM/SFA。ユーザーはチャットで業務指示を出し、Claude AI が動的にフォームやテーブルを生成して操作を完結させる。

## 技術スタック

| 分類 | 技術 |
|------|------|
| パッケージマネージャー | Bun |
| フロントエンド | SvelteKit 5, TypeScript |
| バリデーション | Zod |
| ORM | DrizzleORM |
| インフラ | Cloudflare (Wrangler, D1, R2, KV, Queue) |
| AI | Claude API (Anthropic) |
| i18n | Paraglide-JS |

## 開発環境のセットアップ

```sh
bun install
```

`.dev.vars` を作成して環境変数を設定:

```
ANTHROPIC_API_KEY="your-api-key-here"
MOCK_AI="true"   # true にするとモックレスポンスで動作確認できる
```

```sh
bun dev   # Vite + platformProxy で HMR 付き起動
```

## UIコンポーネント

コンポーネントは2種類に分類される。

- **`src/lib/components/ui/`** — アプリ UI（デザインシステム）
- **`src/lib/components/chat/`** — AI がノーコードとしてレスポンスに返すコンポーネント

ライブデモは `/ui` ルートで確認できる。

---

### アプリ UI コンポーネント

#### Textbox

テキスト入力フィールド。

```svelte
<Textbox label="会社名" bind:value={name} placeholder="株式会社..." required />
<Textbox label="メール" bind:value={email} type="email" error="正しいメールアドレスを入力してください" />
```

| prop | 型 | 説明 |
|------|----|------|
| `label` | `string?` | ラベルテキスト |
| `value` | `string` (bindable) | 入力値 |
| `type` | `string?` | input の type 属性（デフォルト `text`） |
| `placeholder` | `string?` | プレースホルダー |
| `required` | `boolean?` | 必須マーク表示 |
| `disabled` | `boolean?` | 無効状態 |
| `error` | `string?` | エラーメッセージ |

---

#### Textarea

複数行テキスト入力。

```svelte
<Textarea label="メモ" bind:value={memo} rows={4} placeholder="自由記述..." />
```

| prop | 型 | 説明 |
|------|----|------|
| `rows` | `number?` | 行数（デフォルト `3`） |
| その他 | — | Textbox と同様 |

---

#### Select

ネイティブ select（カスタム矢印付き）。

```svelte
<Select label="ステータス" bind:value={status} options={[
  { value: 'active', label: 'アクティブ' },
  { value: 'inactive', label: '非アクティブ' }
]} />
```

| prop | 型 | 説明 |
|------|----|------|
| `options` | `{ value: string; label: string }[]` | 選択肢 |
| `placeholder` | `string?` | 未選択時の表示テキスト |

---

#### SearchSelect

検索機能付きの Combobox。キーボードナビゲーション（↑↓ Enter Esc）対応。

```svelte
<SearchSelect label="国" bind:value={country} options={countryOptions} placeholder="検索または選択..." />
```

| prop | 型 | 説明 |
|------|----|------|
| `options` | `{ value: string; label: string }[]` | 選択肢 |
| `placeholder` | `string?` | プレースホルダー |

---

#### Toggle

オン/オフ切り替えスイッチ。

```svelte
<Toggle label="メール通知を受け取る" bind:checked={enabled} />
```

| prop | 型 | 説明 |
|------|----|------|
| `label` | `string?` | ラベルテキスト |
| `checked` | `boolean` (bindable) | 状態 |
| `disabled` | `boolean?` | 無効状態 |

---

#### MultiSelect

複数選択ボタン（チェックボックスの代替）。値は `string[]`。

```svelte
<MultiSelect label="タグ" bind:value={tags} options={[
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'パートナー' }
]} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string[]` (bindable) | 選択中の値の配列 |
| `options` | `{ value: string; label: string }[]` | 選択肢 |

---

#### SingleSelect

単一選択ボタン（ラジオボタンの代替）。セグメントコントロール風。

```svelte
<SingleSelect label="優先度" bind:value={priority} options={[
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]} />
```

---

#### DatePicker

日付入力（ネイティブ `<input type="date">`）。

```svelte
<DatePicker label="契約日" bind:value={date} min="2024-01-01" />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string` (bindable) | ISO 8601 形式の日付文字列 |
| `min` / `max` | `string?` | 入力範囲 |

---

#### TimePicker

時刻入力（ネイティブ `<input type="time">`）。

```svelte
<TimePicker label="開始時刻" bind:value={time} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string` (bindable) | `HH:MM` 形式 |

---

#### DateTimePicker

日時入力（ネイティブ `<input type="datetime-local">`）。

```svelte
<DateTimePicker label="予定日時" bind:value={datetime} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string` (bindable) | `YYYY-MM-DDTHH:MM` 形式 |
| `min` / `max` | `string?` | 入力範囲 |

---

#### NumberInput

数値入力（−/＋ ステッパーボタン付き）。ブラウザのスピンボタンは非表示。

```svelte
<NumberInput label="数量" bind:value={qty} min={0} max={100} step={5} suffix="個" />
<NumberInput label="金額" bind:value={amount} prefix="¥" step={1000} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `number` (bindable) | 数値 |
| `min` / `max` | `number?` | 範囲（上下限でボタン無効化） |
| `step` | `number?` | ステップ量（デフォルト `1`） |
| `prefix` / `suffix` | `string?` | 前後の単位表示 |

---

#### FileUpload

ドラッグ&ドロップ対応のファイル選択エリア。

```svelte
<FileUpload label="添付ファイル" accept=".pdf,.xlsx" multiple />
```

| prop | 型 | 説明 |
|------|----|------|
| `accept` | `string?` | 許可する拡張子 |
| `multiple` | `boolean?` | 複数ファイル選択 |

---

#### Table

ソート・ページネーション付きのデータテーブル。

```svelte
<Table
  columns={[
    { key: 'name', label: '会社名', sortable: true },
    { key: 'status', label: 'ステータス' }
  ]}
  rows={tableData}
  pageSize={10}
/>
```

| prop | 型 | 説明 |
|------|----|------|
| `columns` | `{ key, label, sortable? }[]` | カラム定義 |
| `rows` | `Record<string, unknown>[]` | データ |
| `pageSize` | `number?` | 1ページの行数（デフォルト `10`） |

---

#### Pagination

ページネーションコントロール（Table 内でも使用）。

```svelte
<Pagination bind:page={currentPage} totalPages={20} />
```

| prop | 型 | 説明 |
|------|----|------|
| `page` | `number` (bindable) | 現在のページ（1始まり） |
| `totalPages` | `number` | 総ページ数 |

---

#### List

カード表示のリスト。ジェネリクス対応で型安全なスニペットを受け取る。

```svelte
<List items={customers} columns={3}>
  {#snippet card(c)}
    <p>{c.name}</p>
    <p>{c.contact}</p>
  {/snippet}
</List>
```

| prop | 型 | 説明 |
|------|----|------|
| `items` | `T[]` | データ配列 |
| `columns` | `number?` | グリッド列数（デフォルト `2`） |
| `card` | `Snippet<[T]>` | カードのレンダリングスニペット |

---

#### DataGrid

スプレッドシート型のグリッド入力。Tab/Enter キーでセル移動。

```svelte
<DataGrid
  bind:rows={gridRows}
  columns={[
    { key: 'name', label: '氏名', width: 160 },
    { key: 'dept', label: '部署', type: 'select', options: [
      { value: 'sales', label: '営業' },
      { value: 'eng', label: 'エンジニア' }
    ]},
    { key: 'age', label: '年齢', type: 'number', width: 90 },
    { key: 'note', label: '備考', readonly: true }
  ]}
  onchange={(rows) => console.log(rows)}
/>
```

| prop | 型 | 説明 |
|------|----|------|
| `columns` | `GridColumn[]` | カラム定義 |
| `rows` | `GridRow[]` (bindable) | データ（`Record<string, string\|number\|null>`） |
| `addable` | `boolean?` | 行追加ボタン表示（デフォルト `true`） |
| `deletable` | `boolean?` | 行削除ボタン表示（デフォルト `true`） |
| `onchange` | `(rows) => void?` | 変更コールバック |

**GridColumn のフィールド:**

| フィールド | 型 | 説明 |
|----------|----|------|
| `key` | `string` | データキー |
| `label` | `string` | ヘッダーテキスト |
| `type` | `'text'\|'number'\|'select'?` | セルの入力タイプ |
| `options` | `{ value, label }[]?` | type が `select` のときの選択肢 |
| `width` | `number?` | 列幅（px） |
| `readonly` | `boolean?` | 編集不可 |

**キーボード操作:**

| キー | 動作 |
|------|------|
| Tab / Shift+Tab | 次/前のセルへ移動 |
| Enter | 下のセルへ移動 |
| Esc | 編集を終了 |

---

#### BarChart

SVG棒グラフ（外部ライブラリ不使用）。

```svelte
<BarChart title="月別売上（万円）" data={[
  { label: '1月', value: 120 },
  { label: '2月', value: 85 }
]} />
```

| prop | 型 | 説明 |
|------|----|------|
| `data` | `{ label: string; value: number }[]` | データ |
| `title` | `string?` | グラフタイトル |
| `color` | `string?` | バーの色（CSS変数可） |

---

#### LineChart

SVG折れ線グラフ（エリア塗りつぶし付き）。

```svelte
<LineChart title="四半期推移" data={quarterData} color="var(--chart-3)" />
```

| prop | 型 | 説明 |
|------|----|------|
| `data` | `{ label: string; value: number }[]` | データ |
| `color` | `string?` | 線・エリアの色 |

---

#### PieChart

SVG円グラフ（ドーナツモード対応）。

```svelte
<PieChart title="ステータス分布" data={pieData} donut />
```

| prop | 型 | 説明 |
|------|----|------|
| `data` | `{ label: string; value: number }[]` | データ |
| `donut` | `boolean?` | ドーナツ型にする |

---

#### TypingIndicator

AIのタイピング中アニメーション（3点ドット）。

```svelte
{#if isLoading}
  <TypingIndicator />
{/if}
```

---

### チャット UI コンポーネント（`src/lib/components/chat/`）

AI がレスポンスとして返す動的UIコンポーネント。システムプロンプトの仕様に従って AI が `<ui type="...">` タグを出力し、クライアント側でパースされて描画される。

#### Form（チャット用）

```
<ui type="form" title="顧客登録">
[{"key":"name","label":"会社名","type":"text","required":true},{"key":"industry","label":"業種","type":"select","options":[...]}]
</ui>
```

フィールドタイプ: `text` / `email` / `number` / `textarea` / `select` / `date`

#### Table（チャット用）

```
<ui type="table" title="顧客一覧">
{"columns":[{"key":"name","label":"会社名"},...],"rows":[...]}
</ui>
```

#### ActionSelector

```
<ui type="actions" title="どうしますか？">
[{"id":"create","label":"顧客を登録する","description":"新規顧客情報をフォームで入力します"}]
</ui>
```

ユーザーがアクションを選択すると、そのラベルがチャット入力として送信される。

---

## ディレクトリ構成

```
midleton/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte    # サイドバー・テーマ切り替え
│   │   ├── +page.svelte      # チャット画面
│   │   ├── ui/               # UIコンポーネントデモ（/ui）
│   │   ├── settings/         # 設定画面
│   │   └── api/chat/         # チャット API エンドポイント
│   └── lib/
│       ├── components/
│       │   ├── ui/           # アプリUIコンポーネント（デザインシステム）
│       │   └── chat/         # AI がレスポンスとして返すコンポーネント
│       ├── server/
│       │   ├── db/           # DrizzleORM スキーマ・クエリ
│       │   ├── mcp/          # MCP ツール定義
│       │   └── ai/           # Claude API 連携・システムプロンプト
│       ├── styles/           # グローバルスタイル・テーマ
│       └── types/            # 共通型定義
├── messages/                 # i18n リソース（ja.json）
├── drizzle/                  # マイグレーションファイル
├── docs/
│   └── ROADMAP.md
└── wrangler.toml
```

## テーマ

ダーク / ライト / システム（OS 設定追従）の3択。サイドバー下部のスイッチで切り替え。CSS カスタムプロパティ（`--color-*`）でトークンを定義し `data-theme` 属性で切り替える。

## i18n

`messages/ja.json` に日本語リソースを定義し `m.key()` 形式で参照する（Paraglide-JS）。
