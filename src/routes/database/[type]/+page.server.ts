import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo, listRecords } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = createDb(platform!.env.DB);
	const info = await getTableInfo(db, params.type);
	if (!info) return { info: null, rows: [] };
	const rows = await listRecords(db, params.type);
	return { info, rows };
};
