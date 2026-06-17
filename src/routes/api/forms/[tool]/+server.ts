import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getReminderChannelOptions } from '$lib/server/db/reminder-service';
import type { FormField } from '$lib/types/chat';
import type { ToolEnv } from '$lib/server/mcp';

// 既知のツールに対するサーバー定義フォームを返す。
// FormPanel はこのエンドポイントからフィールド構造を取得し、AIが提供した値をプリフィルとして適用する。
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'DB not configured' }, { status: 500 });
	}

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};

	const { tool } = params;

	if (tool === 'create_reminder') {
		const options = await getReminderChannelOptions(db, toolEnv);
		const fields: FormField[] = [
			{ key: 'remind_at', label: '日時', type: 'datetime-local', required: true },
			{ key: 'channels', label: '通知先', type: 'multiselect', required: true, value: 'notification', options },
			{ key: 'content', label: '内容', type: 'textarea', required: true }
		];
		return json({ title: 'リマインダー設定', fields });
	}

	if (tool === 'create_customer') {
		const fields: FormField[] = [
			{ key: 'name', label: '会社名', type: 'text', required: true },
			{ key: 'email', label: 'メールアドレス', type: 'email' },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'postal_code', label: '郵便番号', type: 'text' },
			{ key: 'address', label: '住所', type: 'text' },
			{ key: 'website', label: 'ホームページ', type: 'text' },
			{
				key: 'status',
				label: 'ステータス',
				type: 'select',
				value: 'active',
				options: [
					{ label: '有効', value: 'active' },
					{ label: '無効', value: 'inactive' }
				]
			},
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '顧客情報登録', fields });
	}

	return json({ error: 'Not found' }, { status: 404 });
};
