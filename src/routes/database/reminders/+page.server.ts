import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listReminders, getReminderChannelOptions } from '$lib/server/db/reminder-service';

export const load: PageServerLoad = async ({ platform }) => {
	const db = createDb(platform!.env.DB);
	const [rows, channelOptions] = await Promise.all([
		listReminders(db),
		getReminderChannelOptions(db, platform!.env)
	]);
	return { rows, channelOptions };
};
