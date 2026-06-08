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
