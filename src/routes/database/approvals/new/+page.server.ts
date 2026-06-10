import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listAccounts } from '$lib/server/db/account-service';

export const load: PageServerLoad = async ({ platform }) => {
	const db = createDb(platform!.env.DB);
	const accountOptions = await listAccounts(db);
	return { accountOptions };
};
