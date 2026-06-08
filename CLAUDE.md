# Midleton

AIファーストなチャットベースの CRM/SFA。
SvelteKit + Claude AI + MCP サーバー構成。ユーザーはチャットで業務指示を出し、AIが動的にフォームやテーブルを生成して操作を完結させる。

## 技術スタック

- **フロントエンド**: SvelteKit, TypeScript
- **バリデーション**: Zod
- **ORM**: DrizzleORM
- **インフラ**: Cloudflare (Wrangler, D1, R2, KV, Queue)
- **AI**: Claude API (Anthropic)
- **プロトコル**: MCP (Model Context Protocol)

## ディレクトリ構成（予定）

```
midleton/
├── src/
│   ├── routes/
│   │   ├── chat/         # チャット画面
│   │   ├── settings/     # 設定画面
│   │   └── templates/    # テンプレート管理
│   ├── lib/
│   │   ├── components/   # UIコンポーネント（デザインシステム）
│   │   ├── server/       # サーバーサイドロジック
│   │   │   ├── db/       # DrizzleORM スキーマ・クエリ
│   │   │   ├── mcp/      # MCPサーバー・ツール定義
│   │   │   └── ai/       # Claude API 連携
│   │   └── types/        # 共通型定義
│   └── app.html
├── drizzle/              # マイグレーションファイル
├── docs/
│   ├── concept.md
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

## Git ルール

- コミットメッセージは英語で記載する
- Co-Authored-By 等の共同作業者表記は付けない
- **コミットはユーザーからの明示的な指示があるまで行わない**（実装確認後にコミット）
- 作業完了時は `docs/ROADMAP.md` の該当タスクをチェックし、仕様変更があれば `CLAUDE.md` も更新する

## 開発ルール

- UIコンポーネントは `src/lib/components/` に集約する。AIが参照するコンポーネント仕様はシステムプロンプトで管理する。
- DBスキーマ変更は必ず Drizzle マイグレーションを通す。直接 D1 を操作しない。
- MCP ツールは `src/lib/server/mcp/` に定義し、Zod でスキーマを検証する。
- 秘匿情報（API キー等）は Cloudflare の環境変数または KV に保存する。コードに埋め込まない。
- AIへのシステムプロンプトは `src/lib/server/ai/` で一元管理する。

## ロードマップ

`docs/ROADMAP.md` を参照。

## 参考

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [DrizzleORM](https://orm.drizzle.team/)
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
- [Anthropic API](https://docs.anthropic.com/)
