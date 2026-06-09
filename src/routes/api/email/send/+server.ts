import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail, getEmailSetupFromEnv } from '$lib/server/email';
import { errors } from '$lib/server/errors';

export const POST: RequestHandler = async ({ request, platform }) => {
	const setup = getEmailSetupFromEnv(platform?.env ?? {});
	if (!setup) return errors.serviceUnavailable('メール設定が構成されていません（EMAIL_PROVIDER / EMAIL_FROM を設定してください）');

	try {
		const body = await request.json() as {
			to: string | string[];
			subject: string;
			html?: string;
			text?: string;
		};

		if (!body.to || (Array.isArray(body.to) && body.to.length === 0)) {
			return errors.badRequest('送信先アドレスは必須です');
		}
		if (!body.subject?.trim()) return errors.badRequest('件名は必須です');
		if (!body.html && !body.text) return errors.badRequest('html または text の本文が必要です');

		await sendEmail(setup.providerConfig, {
			from: setup.from,
			fromName: setup.fromName,
			to: body.to,
			subject: body.subject,
			html: body.html,
			text: body.text
		});

		const toList = Array.isArray(body.to) ? body.to : [body.to];
		return json({ success: true, message: `${toList.join(', ')} にメールを送信しました` });
	} catch (e) {
		return errors.internal(e);
	}
};
