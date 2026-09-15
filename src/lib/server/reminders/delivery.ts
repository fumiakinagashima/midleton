import { and, eq, lte } from 'drizzle-orm';
import { reminders, type Reminder } from '../db/schema';
import { parseChannels } from '../db/reminder-service';
import { createNotification } from '../db/notification-service';
import { getAccount } from '../db/account-service';
import { getSlackIntegration, sendSlackMessage } from '../slack';
import { getEmailSetupFromEnv, sendEmail, type EmailEnv } from '../email';
import type { Db } from '../db';

// Fallback destination when a reminder has no accountId set (existing data from before login was implemented)
const REMINDER_EMAIL_TO = 'alcogyinc@gmail.com';

export type ReminderDeliveryResult = {
	id: string;
	status: 'sent' | 'failed';
	errors: string[];
};

export async function getDueReminders(db: Db, now: Date = new Date()): Promise<Reminder[]> {
	return db
		.select()
		.from(reminders)
		.where(and(eq(reminders.status, 'pending'), lte(reminders.remindAt, now)));
}

async function deliverToChannel(db: Db, channel: string, reminder: Reminder, env?: EmailEnv): Promise<void> {
	if (channel === 'notification') {
		// Skip legacy data with no accountId set (the notification destination cannot be determined)
		if (!reminder.accountId) return;
		await createNotification(db, {
			type: 'reminder',
			title: 'Reminder',
			body: reminder.content,
			seedContent: [{ type: 'text', text: `Reminder: ${reminder.content}` }],
			accountId: reminder.accountId
		});
		return;
	}

	if (channel === 'email') {
		// Notification emails use the system email settings from environment variables (EMAIL_PROVIDER etc.),
		// separate from the "sender email settings" (/settings/email, used for send_email)
		const setup = getEmailSetupFromEnv(env ?? {});
		if (!setup) throw new Error('System email is not configured (check environment variables such as EMAIL_PROVIDER)');
		const account = reminder.accountId ? await getAccount(db, reminder.accountId) : null;
		const to = account?.email ?? REMINDER_EMAIL_TO;
		await sendEmail(setup.providerConfig, {
			from: setup.from,
			fromName: setup.fromName,
			to,
			subject: 'Reminder',
			text: reminder.content
		});
		return;
	}

	if (channel.startsWith('slack:')) {
		const integration = await getSlackIntegration(db, channel.slice('slack:'.length));
		if (!integration) throw new Error(`Slack integration not found: ${channel}`);
		await sendSlackMessage(integration, reminder.content);
		return;
	}

	throw new Error(`Unsupported notification channel: ${channel}`);
}

export async function deliverReminder(db: Db, reminder: Reminder, env?: EmailEnv): Promise<ReminderDeliveryResult> {
	const channels = parseChannels(reminder.channels);
	const deliveryErrors: string[] = [];
	for (const channel of channels) {
		try {
			await deliverToChannel(db, channel, reminder, env);
		} catch (e) {
			deliveryErrors.push(`${channel}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	const status = deliveryErrors.length === 0 ? 'sent' : 'failed';
	await db.update(reminders).set({ status }).where(eq(reminders.id, reminder.id));
	return { id: reminder.id, status, errors: deliveryErrors };
}

export async function processDueReminders(
	db: Db,
	env?: EmailEnv,
	now: Date = new Date()
): Promise<ReminderDeliveryResult[]> {
	const due = await getDueReminders(db, now);
	const results: ReminderDeliveryResult[] = [];
	for (const reminder of due) {
		results.push(await deliverReminder(db, reminder, env));
	}
	return results;
}
