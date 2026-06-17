import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { listWorkflows } from '$lib/server/db/workflow-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!platform?.env?.DB) throw error(500, 'DB not available');
	const db = createDb(platform.env.DB);
	const rows = await listWorkflows(db, locals.account?.id);
	return { rows };
};
