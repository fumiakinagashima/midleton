import type { LayoutServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { countUnreadNotifications } from '$lib/server/db/notification-service';

export const load: LayoutServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { unreadNotificationCount: 0 };
	const db = createDb(platform.env.DB);
	const unreadNotificationCount = await countUnreadNotifications(db);
	return { unreadNotificationCount };
};
