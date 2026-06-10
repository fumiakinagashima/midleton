import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listApprovals } from '$lib/server/db/approval-service';

export const load: PageServerLoad = async ({ platform }) => {
	const db = createDb(platform!.env.DB);
	const rows = await listApprovals(db);
	return { rows };
};
