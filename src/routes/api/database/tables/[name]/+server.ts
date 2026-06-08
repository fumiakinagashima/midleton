import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updateEntityType, deleteEntityType, type EntityTypeInput } from '$lib/server/db/table-service';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const input = await request.json() as Partial<EntityTypeInput>;
		await updateEntityType(db, params.name, input);
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deleteEntityType(db, params.name);
	return new Response(null, { status: 204 });
};
