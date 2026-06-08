import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export const tools: Tool[] = [
	// ── Customers ──────────────────────────────────────────────────────────
	{
		name: 'get_customers',
		description: '顧客一覧を取得する。名前・ステータスで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '顧客名（部分一致）' },
				status: { type: 'string', enum: ['active', 'inactive'], description: 'ステータスで絞り込む' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'get_customer',
		description: '指定IDの顧客を1件取得する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID' }
			},
			required: ['id']
		}
	},
	{
		name: 'create_customer',
		description: '新しい顧客を登録する。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '会社名（必須）' },
				contact_name: { type: 'string', description: '担当者名' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				address: { type: 'string', description: '住所' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（任意のキー/値）' }
			},
			required: ['name']
		}
	},
	{
		name: 'update_customer',
		description: '既存の顧客情報を更新する。指定したフィールドのみ更新される。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID（必須）' },
				name: { type: 'string', description: '会社名' },
				contact_name: { type: 'string', description: '担当者名' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				address: { type: 'string', description: '住所' },
				status: { type: 'string', enum: ['active', 'inactive'], description: 'ステータス' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（既存データとマージされる）' }
			},
			required: ['id']
		}
	},
	{
		name: 'delete_customer',
		description: '顧客を削除する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID' }
			},
			required: ['id']
		}
	},

	// ── Contacts ───────────────────────────────────────────────────────────
	{
		name: 'get_contacts',
		description: '担当者一覧を取得する。顧客IDで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客IDで絞り込む' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'create_contact',
		description: '担当者を登録する。顧客IDは必須。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '紐付ける顧客のID（必須）' },
				name: { type: 'string', description: '担当者名（必須）' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				role: { type: 'string', description: '役職' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド' }
			},
			required: ['customer_id', 'name']
		}
	},
	{
		name: 'update_contact',
		description: '担当者情報を更新する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '担当者ID（必須）' },
				name: { type: 'string', description: '担当者名' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				role: { type: 'string', description: '役職' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（既存データとマージ）' }
			},
			required: ['id']
		}
	},

	// ── Deals ──────────────────────────────────────────────────────────────
	{
		name: 'get_deals',
		description: '案件一覧を取得する。顧客IDやステータスで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客IDで絞り込む' },
				status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'ステータスで絞り込む' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'create_deal',
		description: '案件を登録する。顧客IDは必須。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客のID（必須）' },
				title: { type: 'string', description: '案件タイトル（必須）' },
				amount: { type: 'number', description: '金額（円）' },
				status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'ステータス（デフォルト: open）' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド' }
			},
			required: ['customer_id', 'title']
		}
	},
	{
		name: 'update_deal',
		description: '案件情報を更新する。ステータスの変更（受注・失注など）にも使う。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '案件ID（必須）' },
				title: { type: 'string', description: '案件タイトル' },
				amount: { type: 'number', description: '金額（円）' },
				status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'ステータス' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（既存データとマージ）' }
			},
			required: ['id']
		}
	},

	// ── Activities ─────────────────────────────────────────────────────────
	{
		name: 'get_activities',
		description: '活動履歴を取得する。対象エンティティのIDと種別を指定する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_id: { type: 'string', description: '対象のID' },
				entity_type: {
					type: 'string',
					enum: ['customer', 'contact', 'deal', 'entity'],
					description: '対象の種別'
				},
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 20）' }
			},
			required: ['entity_id', 'entity_type']
		}
	},
	{
		name: 'create_activity',
		description: '活動履歴（メモ・通話・メール・面談）を記録する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_id: { type: 'string', description: '記録先のID（顧客・担当者・案件・カスタムエンティティ）' },
				entity_type: {
					type: 'string',
					enum: ['customer', 'contact', 'deal', 'entity'],
					description: '記録先の種別'
				},
				type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting'],
					description: '活動の種別（note: メモ / call: 通話 / email: メール / meeting: 面談）'
				},
				content: { type: 'string', description: '活動内容（必須）' }
			},
			required: ['entity_id', 'entity_type', 'content']
		}
	},

	// ── User-defined entity types ──────────────────────────────────────────
	{
		name: 'list_entity_types',
		description: 'ユーザーが定義したカスタムテーブル（エンティティ種別）の一覧を取得する。',
		input_schema: {
			type: 'object',
			properties: {},
			required: []
		}
	},
	{
		name: 'get_entity_fields',
		description: '指定したカスタムテーブルのフィールド定義を取得する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID' }
			},
			required: ['entity_type_id']
		}
	},
	{
		name: 'create_entity_type',
		description: 'ユーザー定義のカスタムテーブルを新規作成する。例: 在庫管理・プロジェクト管理など。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'テーブルの識別名（英小文字・アンダースコア推奨）' },
				label: { type: 'string', description: 'テーブルの表示名（例: 在庫管理）' },
				icon: { type: 'string', description: 'アイコン（絵文字推奨 例: 📦）' }
			},
			required: ['name', 'label']
		}
	},
	{
		name: 'add_entity_field',
		description: 'カスタムテーブルにフィールドを追加する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID（必須）' },
				key: { type: 'string', description: 'フィールドキー（英小文字・アンダースコア推奨）' },
				label: { type: 'string', description: 'フィールドの表示名' },
				type: {
					type: 'string',
					enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea'],
					description: 'フィールドの型'
				},
				required: { type: 'boolean', description: '必須フィールドかどうか' },
				options: {
					type: 'array',
					items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } },
					description: 'type が select のときの選択肢'
				}
			},
			required: ['entity_type_id', 'key', 'label']
		}
	},
	{
		name: 'get_entities',
		description: 'カスタムテーブルのレコード一覧を取得する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID（必須）' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: ['entity_type_id']
		}
	},
	{
		name: 'create_entity',
		description: 'カスタムテーブルにレコードを登録する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID（必須）' },
				data: { type: 'object', description: 'レコードのデータ（フィールドキー: 値）' }
			},
			required: ['entity_type_id', 'data']
		}
	},
	{
		name: 'update_entity',
		description: 'カスタムテーブルのレコードを更新する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'レコードID（必須）' },
				data: { type: 'object', description: '更新するデータ（既存データとマージされる）' }
			},
			required: ['id', 'data']
		}
	}
];
