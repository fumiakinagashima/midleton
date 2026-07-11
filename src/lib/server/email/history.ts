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

// メール送信を実行し、成否によらず email_sends に履歴を記録する。
// 送信自体が失敗した場合は履歴記録後にエラーを再スローする（呼び出し元の既存のエラー処理を変えない）。
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
