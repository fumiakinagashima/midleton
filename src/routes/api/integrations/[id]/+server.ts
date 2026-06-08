import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { integrations } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const updateSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	baseUrl: z.string().url().optional(),
	authType: z.enum(['none', 'api_key', 'bearer', 'basic']).optional(),
	authConfig: z.record(z.string(), z.string()).optional()
});

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const data = updateSchema.parse(await request.json());
	await db
		.update(integrations)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.description !== undefined && { description: data.description }),
			...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
			...(data.authType !== undefined && { authType: data.authType }),
			...(data.authConfig !== undefined && { authConfig: JSON.stringify(data.authConfig) }),
			updatedAt: new Date()
		})
		.where(eq(integrations.id, params.id));
	const [row] = await db.select().from(integrations).where(eq(integrations.id, params.id));
	if (!row) return json({ error: 'Not found' }, { status: 404 });
	return json({ ...row, authConfig: JSON.parse(row.authConfig ?? '{}') });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await db.delete(integrations).where(eq(integrations.id, params.id));
	return json({ deleted: true });
};
