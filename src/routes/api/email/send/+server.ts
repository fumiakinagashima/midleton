import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEmailSetup } from '$lib/server/email';
import { sendEmailAndRecord } from '$lib/server/email/history';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('DB is not available');
	const db = createDb(platform.env.DB);
	const setup = await getEmailSetup(db, platform?.env ?? {});
	if (!setup) return errors.serviceUnavailable('Email settings are not configured (set them at /settings/email, or configure EMAIL_PROVIDER / EMAIL_FROM)');

	try {
		const body = await request.json() as {
			to: string | string[];
			subject: string;
			html?: string;
			text?: string;
		};

		if (!body.to || (Array.isArray(body.to) && body.to.length === 0)) {
			return errors.badRequest('Recipient address is required');
		}
		if (!body.subject?.trim()) return errors.badRequest('Subject is required');
		if (!body.html && !body.text) return errors.badRequest('An html or text body is required');

		await sendEmailAndRecord(
			db,
			setup.providerConfig,
			{ from: setup.from, fromName: setup.fromName, to: body.to, subject: body.subject, html: body.html, text: body.text },
			{ accountId: locals.account?.id, source: 'api' }
		);

		const toList = Array.isArray(body.to) ? body.to : [body.to];
		return json({ success: true, message: `Email sent to ${toList.join(', ')}` });
	} catch (e) {
		return errors.internal(e);
	}
};
