import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { integrations } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = createDb(platform!.env.DB);
	const rows = await db.select().from(integrations).orderBy(asc(integrations.name));
	const items = rows.map((r) => ({ ...r, authConfig: JSON.parse(r.authConfig ?? '{}') as Record<string, string> }));
	return { account: locals.account!, items };
};
