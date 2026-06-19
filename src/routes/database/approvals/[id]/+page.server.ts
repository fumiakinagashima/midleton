import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getApproval } from '$lib/server/db/approval-service';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = createDb(platform!.env.DB);
	const row = await getApproval(db, params.id);
	return { row, accountId: locals.account?.id };
};
