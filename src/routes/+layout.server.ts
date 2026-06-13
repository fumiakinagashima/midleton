import type { LayoutServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { countUnreadNotifications } from '$lib/server/db/notification-service';
import { listChats } from '$lib/server/db/chat-service';

export const load: LayoutServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { unreadNotificationCount: 0, chats: [] };
	const db = createDb(platform.env.DB);
	const [unreadNotificationCount, chatRows] = await Promise.all([
		countUnreadNotifications(db),
		listChats(db)
	]);
	const chats = chatRows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
	return { unreadNotificationCount, chats };
};
