import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { deleteReminder } from '$lib/server/db/reminder-service';

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deleteReminder(db, params.id);
	return new Response(null, { status: 204 });
};
