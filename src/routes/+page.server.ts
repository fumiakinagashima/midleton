import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getNotification, markNotificationRead } from '$lib/server/db/notification-service';

export const load: PageServerLoad = async ({ url, platform }) => {
	const notificationId = url.searchParams.get('notification');
	if (!notificationId || !platform?.env?.DB) return { seedNotification: null };

	const db = createDb(platform.env.DB);
	const notification = await getNotification(db, notificationId);
	if (!notification) return { seedNotification: null };

	if (!notification.isRead) await markNotificationRead(db, notificationId);

	return {
		seedNotification: { id: notification.id, seedContent: notification.seedContent }
	};
};
