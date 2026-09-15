import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { getEmailSetup } from '../email';
import { sendEmailAndRecord } from '../email/history';
import { recordActivity } from '../db/table-service';
import { createReminder, listReminders, resolveChannelLabels, deleteSentReminders } from '../db/reminder-service';
import { deleteReadNotifications, createNotification } from '../db/notification-service';
import { getSlackIntegration, sendSlackMessage } from '../slack';
import { parseJstDatetime } from '$lib/datetime';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'delete_sent_reminders',
		description:
			'Deletes all sent (status=sent) reminders at once. Unsent (pending) reminders are not deleted. Only affects the current user\'s own reminders.',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'delete_read_notifications',
		description:
			'Deletes all read notifications at once. Unread notifications are not deleted. Only affects the current user\'s own notifications.',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'list_reminders',
		description:
			'Fetches the list of registered reminders. Used for requests like "Show me my reminders" or "What reminders have I set?".',
		input_schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['pending', 'sent', 'failed'],
					description: 'Filter by status (returns all if omitted)'
				}
			},
			required: []
		}
	},
	{
		name: 'send_email',
		description:
			'Sends an email to the specified recipient. On success, if customer_id is given, an "email" entry is automatically added to the activity history.',
		input_schema: {
			type: 'object',
			properties: {
				to: { type: 'string', description: 'Recipient email address' },
				subject: { type: 'string', description: 'Subject' },
				body: { type: 'string', description: 'Body (plain text)' },
				customer_id: {
					type: 'string',
					description: 'Related customer ID (if given, this is recorded in the activity history)'
				}
			},
			required: ['to', 'subject', 'body']
		}
	},
	{
		name: 'send_notification',
		description:
			'Sends a notification to the notification center addressed to yourself. Use when you want to notify via an in-app notification rather than email.',
		input_schema: {
			type: 'object',
			properties: {
				title: { type: 'string', description: 'Notification title' },
				body: { type: 'string', description: 'Notification body' }
			},
			required: ['title', 'body']
		}
	},
	{
		name: 'create_reminder',
		description:
			'Registers a reminder for a specified date/time (registration only; the actual notification delivery happens separately).',
		input_schema: {
			type: 'object',
			properties: {
				remind_at: { type: 'string', description: 'Notification date/time (YYYY-MM-DDTHH:mm format)' },
				content: { type: 'string', description: 'Reminder content' },
				channels: {
					type: 'string',
					description: 'Notification channels (comma-separated). notification / email / slack:<integration_id>'
				}
			},
			required: ['remind_at', 'content', 'channels']
		}
	},
	{
		name: 'create_reminders_bulk',
		description:
			'Registers multiple reminders at once. Used to register a batch of reminders together, e.g. from a follow-up suggestion list. ' +
			'remind_at and channels are shared across all entries; only the content is specified per entry.',
		input_schema: {
			type: 'object',
			properties: {
				remind_at: { type: 'string', description: 'Shared notification date/time (YYYY-MM-DDTHH:mm format)' },
				channels: {
					type: 'string',
					description: 'Shared notification channels (comma-separated). notification / email / slack:<integration_id>'
				},
				reminders: {
					type: 'array',
					description: 'List of reminders to register',
					items: {
						type: 'object',
						properties: {
							content: { type: 'string', description: 'Reminder content' }
						},
						required: ['content']
					}
				}
			},
			required: ['remind_at', 'channels', 'reminders']
		}
	}
];

const listRemindersSchema = z.object({
	status: z.enum(['pending', 'sent', 'failed']).optional()
});

export async function handleListReminders(db: Db, input: unknown, env?: ToolEnv) {
	const { status } = listRemindersSchema.parse(input);
	const rows = await listReminders(db, env?.accountId);
	const filtered = status ? rows.filter((r) => r.status === status) : rows;
	return filtered.map((r) => ({
		id: r.id,
		content: r.content,
		remindAt: r.remindAt.toISOString(),
		channels: r.channelLabels.join(', '),
		status: r.status
	}));
}

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
			'Email sending is not configured (set it up at /settings/email, or set environment variables such as EMAIL_PROVIDER / EMAIL_FROM)'
		);
	}
	const body = setup.signature ? `${data.body}\n\n${setup.signature}` : data.body;
	await sendEmailAndRecord(
		db,
		setup.providerConfig,
		{ from: setup.from, fromName: setup.fromName, to: data.to, subject: data.subject, text: body },
		{ customerId: data.customer_id, accountId: env?.accountId, source: 'chat' }
	);
	if (data.customer_id) {
		await recordActivity(
			db,
			data.customer_id,
			'email',
			`Sent email "${data.subject}"`,
			env?.accountId
		);
	}
	return { to: data.to, subject: data.subject };
}

const sendNotificationSchema = z.object({
	title: z.string().min(1),
	body: z.string().min(1)
});

export async function handleSendNotification(db: Db, input: unknown, env?: ToolEnv) {
	const data = sendNotificationSchema.parse(input);
	if (!env?.accountId) throw new Error('Could not determine the recipient account.');
	const notification = await createNotification(db, {
		type: 'workflow',
		title: data.title,
		body: data.body,
		seedContent: [{ type: 'text', text: data.body }],
		accountId: env.accountId
	});
	return { id: notification.id, title: notification.title };
}

const sendSlackNotificationSchema = z.object({
	integration_id: z.string().min(1),
	body: z.string().min(1)
});

/** Workflow-only (not exposed to the AI chat). If the AI needs to send to Slack, it should use list_integrations + call_external_api. */
export async function handleSendSlackNotification(db: Db, input: unknown, _env?: ToolEnv) {
	const data = sendSlackNotificationSchema.parse(input);
	const integration = await getSlackIntegration(db, data.integration_id);
	if (!integration) throw new Error(`Slack integration not found (id: ${data.integration_id})`);
	await sendSlackMessage(integration, data.body);
	return { integrationName: integration.name };
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

export async function handleDeleteSentReminders(db: Db, _input: unknown, env?: ToolEnv) {
	if (!env?.accountId) throw new Error('Could not determine the logged-in user.');
	const count = await deleteSentReminders(db, env.accountId);
	return { deleted: count };
}

export async function handleDeleteReadNotifications(db: Db, _input: unknown, env?: ToolEnv) {
	if (!env?.accountId) throw new Error('Could not determine the logged-in user.');
	const count = await deleteReadNotifications(db, env.accountId);
	return { deleted: count };
}
