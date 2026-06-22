import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { computeBriefing } from '$lib/server/ai/briefing';

export const POST: RequestHandler = async ({ platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const accountId = locals.account?.id ?? null;

	try {
		const contents = await computeBriefing(db, accountId, apiKey);
		return json({ contents });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AIエラー: ${msg}` }, { status: 500 });
	}
};
