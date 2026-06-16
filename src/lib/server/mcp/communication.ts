import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { sendEmail, getEmailSetup } from '../email';
import { recordActivity } from '../db/table-service';
import { createReminder, resolveChannelLabels } from '../db/reminder-service';
import { parseJstDatetime } from '$lib/datetime';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'send_email',
		description:
			'指定した宛先にメールを送信する。送信成功時、customer_id を指定すると活動履歴に「メール」記録が自動追加される。',
		input_schema: {
			type: 'object',
			properties: {
				to: { type: 'string', description: '送信先メールアドレス' },
				subject: { type: 'string', description: '件名' },
				body: { type: 'string', description: '本文（プレーンテキスト）' },
				customer_id: {
					type: 'string',
					description: '関連する顧客ID（指定すると活動履歴に記録される）'
				}
			},
			required: ['to', 'subject', 'body']
		}
	},
	{
		name: 'create_reminder',
		description:
			'指定した日時にリマインダーを登録する（登録のみ。実際の通知送信は別途行われる）。',
		input_schema: {
			type: 'object',
			properties: {
				remind_at: { type: 'string', description: '通知日時（YYYY-MM-DDTHH:mm形式）' },
				content: { type: 'string', description: 'リマインダーの内容' },
				channels: {
					type: 'string',
					description: '通知先（カンマ区切り）。notification / email / slack:<integration_id>'
				}
			},
			required: ['remind_at', 'content', 'channels']
		}
	},
	{
		name: 'create_reminders_bulk',
		description:
			'複数のリマインダーを一括登録する。フォローアップ提案などの一覧からまとめて登録する場合に使う。' +
			'remind_at・channels は全件共通。内容（content）のみ件ごとに指定する。',
		input_schema: {
			type: 'object',
			properties: {
				remind_at: { type: 'string', description: '共通の通知日時（YYYY-MM-DDTHH:mm形式）' },
				channels: {
					type: 'string',
					description: '共通の通知先（カンマ区切り）。notification / email / slack:<integration_id>'
				},
				reminders: {
					type: 'array',
					description: '登録するリマインダーのリスト',
					items: {
						type: 'object',
						properties: {
							content: { type: 'string', description: 'リマインダーの内容' }
						},
						required: ['content']
					}
				}
			},
			required: ['remind_at', 'channels', 'reminders']
		}
	}
];

const sendEmailSchema = z.object({
	to: z.string().email(),
	subject: z.string().min(1),
	body: z.string().min(1),
	customer_id: z.string().optional()
});

export async function handleSendEmail(db: Db, input: unknown, env?: ToolEnv) {
	const data = sendEmailSchema.parse(input);
	const setup = await getEmailSetup(db, env);
	if (!setup) {
		throw new Error(
			'メール送信が設定されていません（/settings/email、または EMAIL_PROVIDER / EMAIL_FROM などの環境変数を設定してください）'
		);
	}
	const body = setup.signature ? `${data.body}\n\n${setup.signature}` : data.body;
	await sendEmail(setup.providerConfig, {
		from: setup.from,
		fromName: setup.fromName,
		to: data.to,
		subject: data.subject,
		text: body
	});
	if (data.customer_id) {
		await recordActivity(
			db,
			data.customer_id,
			'email',
			`メール「${data.subject}」を送信しました`,
			env?.accountId
		);
	}
	return { to: data.to, subject: data.subject };
}

const createReminderSchema = z.object({
	remind_at: z.string().min(1),
	content: z.string().min(1),
	channels: z.string().min(1)
});

export async function handleCreateReminder(db: Db, input: unknown, env?: ToolEnv) {
	const data = createReminderSchema.parse(input);
	const channels = data.channels
		.split(',')
		.map((c) => c.trim())
		.filter(Boolean);
	const reminder = await createReminder(db, {
		remindAt: parseJstDatetime(data.remind_at),
		content: data.content,
		channels,
		accountId: env?.accountId ?? null
	});

	const channelLabels = await resolveChannelLabels(db, channels);

	return { ...reminder, channelLabels };
}

const createRemindersBulkSchema = z.object({
	remind_at: z.string().min(1),
	channels: z.string().min(1),
	reminders: z.array(z.object({ content: z.string().min(1) })).min(1)
});

export async function handleCreateRemindersBulk(db: Db, input: unknown, env?: ToolEnv) {
	const data = createRemindersBulkSchema.parse(input);
	const channels = data.channels.split(',').map((c) => c.trim()).filter(Boolean);
	const remindAt = parseJstDatetime(data.remind_at);
	const accountId = env?.accountId ?? null;

	const created = [];
	for (const item of data.reminders) {
		const reminder = await createReminder(db, { remindAt, content: item.content, channels, accountId });
		created.push(reminder);
	}

	const channelLabels = await resolveChannelLabels(db, channels);

	return {
		count: created.length,
		remind_at: data.remind_at,
		channelLabels,
		reminders: created.map((r) => ({ id: r.id, content: r.content }))
	};
}
