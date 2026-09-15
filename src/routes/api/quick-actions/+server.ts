import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { runQuickAction } from '$lib/server/quick-actions/registry';
import { isQuickActionId } from '$lib/quick-actions/catalog';
import type { MessageContent } from '$lib/types/chat';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'D1 database is not configured. Please start with wrangler dev.' }, { status: 500 });
	}

	const { id } = (await request.json()) as { id?: string };

	if (!id || !isQuickActionId(id)) {
		return json({ contents: [{ type: 'text', text: 'Unknown quick action.' }] satisfies MessageContent[] }, {
			status: 400
		});
	}

	const db = createDb(platform.env.DB);
	const env = { ...platform.env, accountId: locals.account?.id, accountName: locals.account?.name };

	try {
		const contents = await runQuickAction(db, id, env);
		return json({ contents });
	} catch (e) {
		return json({
			contents: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }] satisfies MessageContent[]
		});
	}
};
