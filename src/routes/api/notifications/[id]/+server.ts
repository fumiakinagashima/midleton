import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getNotification, markNotificationRead } from '$lib/server/db/notification-service';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const row = await getNotification(db, params.id);
	if (!row) return json({ error: 'Not found' }, { status: 404 });
	return json(row);
};

export const PATCH: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const row = await markNotificationRead(db, params.id);
	if (!row) return json({ error: 'Not found' }, { status: 404 });
	return json(row);
};
