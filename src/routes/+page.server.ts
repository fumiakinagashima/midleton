import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getNotification, markNotificationRead } from '$lib/server/db/notification-service';
import { getChat, listChatMessages } from '$lib/server/db/chat-service';
import { listEntityTypesForWorkflow, type EntityTypeForWorkflow } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const notificationId = url.searchParams.get('notification');
	const chatId = url.searchParams.get('id');

	if (!platform?.env?.DB) return { seedNotification: null, seedChat: null, entityTypes: [] as EntityTypeForWorkflow[] };

	const db = createDb(platform.env.DB);
	const entityTypes = await listEntityTypesForWorkflow(db);

	if (notificationId) {
		const notification = await getNotification(db, notificationId);
		if (!notification) return { seedNotification: null, seedChat: null, entityTypes };
		if (notification.accountId && notification.accountId !== locals.account!.id) {
			return { seedNotification: null, seedChat: null, entityTypes };
		}

		if (!notification.isRead) await markNotificationRead(db, notificationId);

		return {
			seedNotification: { id: notification.id, seedContent: notification.seedContent },
			seedChat: null,
			entityTypes
		};
	}

	if (chatId) {
		const chat = await getChat(db, chatId);
		if (!chat) return { seedNotification: null, seedChat: null, entityTypes };
		if (chat.accountId && chat.accountId !== locals.account!.id) {
			return { seedNotification: null, seedChat: null, entityTypes };
		}

		const messages = await listChatMessages(db, chatId);
		return { seedNotification: null, seedChat: { id: chat.id, messages }, entityTypes };
	}

	return { seedNotification: null, seedChat: null, entityTypes };
};
