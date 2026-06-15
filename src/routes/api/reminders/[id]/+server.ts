import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { deleteReminder, getReminder } from '$lib/server/db/reminder-service';
import { errors } from '$lib/server/errors';

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);

	const reminder = await getReminder(db, params.id);
	if (!reminder) return errors.notFound();
	if (reminder.accountId && reminder.accountId !== locals.account!.id) return errors.forbidden();

	await deleteReminder(db, params.id);
	return new Response(null, { status: 204 });
};
