import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export const tools: Tool[] = [
	{
		name: 'get_customers',
		description:
			'顧客一覧を取得する。名前やステータスで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: '顧客名（部分一致）'
				},
				status: {
					type: 'string',
					enum: ['active', 'inactive'],
					description: 'ステータスで絞り込む'
				},
				limit: {
					type: 'number',
					description: '取得件数の上限（デフォルト: 50）'
				}
			},
			required: []
		}
	},
	{
		name: 'create_customer',
		description: '新しい顧客を登録する。',
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: '会社名（必須）'
				},
				contact_name: {
					type: 'string',
					description: '担当者名'
				},
				email: {
					type: 'string',
					description: 'メールアドレス'
				},
				phone: {
					type: 'string',
					description: '電話番号'
				},
				address: {
					type: 'string',
					description: '住所'
				},
				notes: {
					type: 'string',
					description: '備考'
				}
			},
			required: ['name']
		}
	}
];
