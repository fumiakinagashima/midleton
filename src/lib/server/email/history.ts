import type { Db } from '../db';
import { emailSends } from '../db/schema';
import { sendEmail, type EmailProviderConfig, type Mail } from './index';

export type RecordEmailSendInput = {
	to: string;
	subject: string;
	body: string;
	customerId?: string | null;
	accountId?: string | null;
	status: 'sent' | 'failed';
	errorMessage?: string | null;
	source: string;
};

export async function recordEmailSend(db: Db, input: RecordEmailSendInput): Promise<void> {
	await db.insert(emailSends).values({
		id: crypto.randomUUID(),
		to: input.to,
		subject: input.subject,
		body: input.body,
		customerId: input.customerId ?? null,
		accountId: input.accountId ?? null,
		status: input.status,
		errorMessage: input.errorMessage ?? null,
		source: input.source
	});
}

// Sends an email and records the result in email_sends regardless of success or failure.
// If the send itself fails, the error is rethrown after the history is recorded (so callers' existing error handling is unaffected).
export async function sendEmailAndRecord(
	db: Db,
	providerConfig: EmailProviderConfig,
	mail: Mail,
	meta: { customerId?: string | null; accountId?: string | null; source: string }
): Promise<void> {
	const to = Array.isArray(mail.to) ? mail.to.join(', ') : mail.to;
	const body = mail.text ?? mail.html ?? '';

	try {
		await sendEmail(providerConfig, mail);
	} catch (e) {
		await recordEmailSend(db, {
			to,
			subject: mail.subject,
			body,
			customerId: meta.customerId,
			accountId: meta.accountId,
			status: 'failed',
			errorMessage: e instanceof Error ? e.message : String(e),
			source: meta.source
		});
		throw e;
	}

	await recordEmailSend(db, {
		to,
		subject: mail.subject,
		body,
		customerId: meta.customerId,
		accountId: meta.accountId,
		status: 'sent',
		source: meta.source
	});
}
