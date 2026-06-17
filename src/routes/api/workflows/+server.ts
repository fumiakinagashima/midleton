import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { createWorkflow } from '$lib/server/db/workflow-service';
import { validateWorkflow } from '$lib/workflow-validation';
import type { WorkflowStep } from '$lib/types/chat';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	try {
		const db = createDb(platform.env.DB);
		const body = (await request.json()) as {
			name?: string;
			triggerHour?: number;
			triggerMinute?: number;
			steps?: WorkflowStep[];
		};
		const name = body.name?.trim();
		if (!name) return json({ error: 'ワークフロー名を入力してください' }, { status: 422 });
		const triggerHour = body.triggerHour ?? 9;
		const triggerMinute = body.triggerMinute ?? 0;
		const steps = body.steps ?? [];

		const validation = validateWorkflow(triggerHour, triggerMinute, steps);
		if (!validation.ok) {
			return json({ error: validation.errors.join(' / ') }, { status: 422 });
		}

		const row = await createWorkflow(db, {
			name,
			steps,
			triggerHour,
			triggerMinute,
			accountId: locals.account?.id
		});
		return json(row);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
