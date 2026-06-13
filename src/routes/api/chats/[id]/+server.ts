import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updateChatTitle, deleteChat } from '$lib/server/db/chat-service';
import { errors } from '$lib/server/errors';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const body = (await request.json()) as { title?: string };
	const title = body.title?.trim();
	if (!title) return errors.badRequest('title は必須です。');

	const db = createDb(platform.env.DB);
	await updateChatTitle(db, params.id, title);

	return json({ ok: true, title });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const db = createDb(platform.env.DB);
	await deleteChat(db, params.id);

	return json({ ok: true });
};
