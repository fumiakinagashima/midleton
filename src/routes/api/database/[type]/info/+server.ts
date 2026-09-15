import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo } from '$lib/server/db/table-service';

// Lightweight endpoint that returns only the table's field definitions (getTableInfo).
// Used by RecordDialog to fetch field definitions for forms/generic detail views (does not fetch rows).
export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const info = await getTableInfo(db, params.type);
	if (!info) return json({ error: 'Table not found' }, { status: 404 });
	return json({ info });
};
