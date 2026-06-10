import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export const tools: Tool[] = [
	// ── External API integrations ──────────────────────────────────────────
	{
		name: 'list_integrations',
		description: '登録済みの外部API連携の一覧を取得する。どの外部APIが使えるか確認するために使う。',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'call_external_api',
		description:
			'設定済みの外部APIを呼び出す。Slackへの通知送信・外部サービスのデータ取得など。まず list_integrations で使える連携を確認してから使う。',
		input_schema: {
			type: 'object',
			properties: {
				integration_id: { type: 'string', description: '連携のID（list_integrations で確認）' },
				endpoint: {
					type: 'string',
					description: 'エンドポイントのパス（例: /chat.postMessage）またはフルURL。Webhook のようにベースURLだけで完結する場合は省略するか "/" を指定する'
				},
				method: {
					type: 'string',
					enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
					description: 'HTTPメソッド'
				},
				body: { type: 'object', description: 'リクエストボディ（JSON）' },
				query: { type: 'object', description: 'クエリパラメータ' },
				headers: { type: 'object', description: '追加リクエストヘッダー' }
			},
			required: ['integration_id', 'endpoint', 'method']
		}
	},

	// ── Search ─────────────────────────────────────────────────────────────
	{
		name: 'search_customers',
		description:
			'案件・活動のリレーション条件で顧客を検索する。「open案件を持つ顧客」「今月面談した顧客」など単純フィルタでは届かない絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '顧客名（部分一致）' },
				status: { type: 'string', enum: ['active', 'inactive'] },
				has_deal_status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: '指定ステータスの案件を持つ顧客に絞り込む'
				},
				deal_since: { type: 'string', description: '案件の対象期間・開始日（ISO 8601）' },
				deal_until: { type: 'string', description: '案件の対象期間・終了日（ISO 8601）' },
				has_activity_type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting'],
					description: '指定種別の活動を持つ顧客に絞り込む'
				},
				activity_since: { type: 'string', description: '活動の対象期間・開始日（ISO 8601）' },
				activity_until: { type: 'string', description: '活動の対象期間・終了日（ISO 8601）' },
				limit: { type: 'number', description: '取得件数（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'search_deals',
		description:
			'案件を複合条件で検索する。顧客名（JOIN）・金額範囲・期間など get_deals より柔軟な絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				customer_name: { type: 'string', description: '顧客名（部分一致）' },
				status: { type: 'string', enum: ['open', 'won', 'lost'] },
				amount_min: { type: 'number', description: '金額の下限（円）' },
				amount_max: { type: 'number', description: '金額の上限（円）' },
				since: { type: 'string', description: '開始日（ISO 8601）' },
				until: { type: 'string', description: '終了日（ISO 8601）' },
				date_field: {
					type: 'string',
					enum: ['created_at', 'closed_at'],
					description: '期間の基準日（デフォルト: created_at）'
				},
				limit: { type: 'number', description: '取得件数（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'search_activities',
		description:
			'活動履歴を複合条件で検索する。ユーザー定義テーブルの活動は entity_type_id で絞り込める。content のキーワード検索も可能。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type: {
					type: 'string',
					enum: ['customer', 'contact', 'deal', 'entity'],
					description: 'エンティティの種別'
				},
				entity_type_id: {
					type: 'string',
					description: 'ユーザー定義テーブルのID（entity_type が entity のとき、そのテーブルの活動に絞り込む）'
				},
				type: { type: 'string', enum: ['note', 'call', 'email', 'meeting'] },
				content: { type: 'string', description: '活動内容のキーワード（部分一致）' },
				since: { type: 'string', description: '開始日（ISO 8601）' },
				until: { type: 'string', description: '終了日（ISO 8601）' },
				limit: { type: 'number', description: '取得件数（デフォルト: 50）' }
			},
			required: []
		}
	},

	// ── Aggregations ───────────────────────────────────────────────────────
	{
		name: 'summarize_deals',
		description:
			'案件を件数・金額でステータス別に集計する。「今月の受注合計は？」「open案件の総額は？」などの質問に使う。期間・顧客で絞り込み可能。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '特定の顧客に絞り込む' },
				since: { type: 'string', description: '集計開始日（ISO 8601 形式 例: 2025-01-01）' },
				until: { type: 'string', description: '集計終了日（ISO 8601 形式 例: 2025-12-31）' },
				date_field: {
					type: 'string',
					enum: ['created_at', 'closed_at'],
					description: '期間絞り込みの基準日（デフォルト: created_at）'
				}
			},
			required: []
		}
	},
	{
		name: 'summarize_customers',
		description: '顧客数をステータス別（active/inactive）に集計する。「顧客数は何社？」「アクティブな顧客は？」などに使う。',
		input_schema: {
			type: 'object',
			properties: {
				since: { type: 'string', description: '登録日の開始日（ISO 8601 形式）' },
				until: { type: 'string', description: '登録日の終了日（ISO 8601 形式）' }
			},
			required: []
		}
	},
	{
		name: 'summarize_activities',
		description:
			'活動履歴を種別（note/call/email/meeting）ごとに件数集計する。「今月の商談数は？」「電話した件数は？」などに使う。期間・対象エンティティで絞り込み可能。',
		input_schema: {
			type: 'object',
			properties: {
				entity_id: { type: 'string', description: '特定のエンティティに絞り込む' },
				entity_type: {
					type: 'string',
					enum: ['customer', 'contact', 'deal', 'entity'],
					description: 'エンティティの種別'
				},
				since: { type: 'string', description: '集計開始日（ISO 8601 形式）' },
				until: { type: 'string', description: '集計終了日（ISO 8601 形式）' }
			},
			required: []
		}
	},

	// ── Customer detail ────────────────────────────────────────────────────
	{
		name: 'get_customer_detail',
		description:
			'顧客の詳細情報（基本情報・担当者・案件・活動履歴）をまとめて取得する。名前（部分一致）またはIDで検索できる。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID（id か name のどちらか一方を指定）' },
				name: { type: 'string', description: '顧客名（部分一致）（id か name のどちらか一方を指定）' },
				activities_limit: { type: 'number', description: '活動履歴の取得件数（デフォルト: 10）' }
			},
			required: []
		}
	},

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
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				postal_code: { type: 'string', description: '郵便番号' },
				address: { type: 'string', description: '住所' },
				website: { type: 'string', description: 'ホームページURL' },
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
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				postal_code: { type: 'string', description: '郵便番号' },
				address: { type: 'string', description: '住所' },
				website: { type: 'string', description: 'ホームページURL' },
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
	{
		name: 'create_customer_with_contact',
		description:
			'新しい顧客（会社）と、その担当者を同時に登録する。名刺情報などから会社と担当者をまとめて新規登録する場合に使う。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '会社名（必須）' },
				email: { type: 'string', description: 'メールアドレス（会社・担当者で共通）' },
				phone: { type: 'string', description: '電話番号（会社・担当者で共通）' },
				address: { type: 'string', description: '住所' },
				website: { type: 'string', description: 'ホームページURL' },
				notes: { type: 'string', description: '備考' },
				contact_name: { type: 'string', description: '担当者氏名（必須）' },
				contact_name_kana: { type: 'string', description: '担当者名のフリガナ（カナ）' },
				contact_role: { type: 'string', description: '担当者の役職' },
				contact_department: { type: 'string', description: '担当者の部署' },
				custom: { type: 'object', description: 'カスタムフィールド（顧客側、任意のキー/値）' }
			},
			required: ['name', 'contact_name']
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
				name_kana: { type: 'string', description: '担当者名のフリガナ（カナ）' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				role: { type: 'string', description: '役職' },
				department: { type: 'string', description: '部署' },
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
				name_kana: { type: 'string', description: '担当者名のフリガナ（カナ）' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				role: { type: 'string', description: '役職' },
				department: { type: 'string', description: '部署' },
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
	},

	// ── Approvals ──────────────────────────────────────────────────────────
	{
		name: 'list_approvals',
		description: '申請一覧を取得する。ステータスや種別で絞り込み可能。',
		input_schema: {
			type: 'object',
			properties: {
				status: {
					type: 'array',
					items: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
					description: 'ステータスで絞り込む（複数指定可）'
				},
				type: { type: 'string', description: '申請種別で絞り込む（例: 値引き申請）' }
			},
			required: []
		}
	},
	{
		name: 'get_approval',
		description: '申請の詳細（承認ルート・各ステップの状況を含む）を取得する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '申請ID' }
			},
			required: ['id']
		}
	},
	{
		name: 'create_approval',
		description: '新しい申請を作成する。承認ルートをステップの配列で指定する。',
		input_schema: {
			type: 'object',
			properties: {
				title: { type: 'string', description: '申請タイトル' },
				submitted_by: { type: 'string', description: '申請者名（任意）' },
				content: { type: 'string', description: '申請内容（テキスト）' },
				route: {
					type: 'array',
					description: '承認ルート。step が同じ番号は並列承認',
					items: {
						type: 'object',
						properties: {
							step: { type: 'number', description: 'ステップ番号（1始まり、同番号は並列）' },
							approver: { type: 'string', description: '承認者名' },
							email: { type: 'string', description: '承認者メール（任意）' },
							role: { type: 'string', description: '役職（任意）' }
						},
						required: ['step', 'approver']
					}
				}
			},
			required: ['title', 'route']
		}
	},
	{
		name: 'update_approval_step',
		description: '申請の特定ステップを承認または否決する。step は route 配列のインデックス（0始まり）。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '申請ID' },
				step: { type: 'number', description: 'routeのインデックス（0始まり）' },
				action: { type: 'string', enum: ['approve', 'reject'], description: '操作' },
				comment: { type: 'string', description: 'コメント（任意）' }
			},
			required: ['id', 'step', 'action']
		}
	},
	{
		name: 'cancel_approval',
		description: '申請を取り消す。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '申請ID' }
			},
			required: ['id']
		}
	},

];
