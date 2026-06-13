import { like } from 'drizzle-orm';
import { integrations } from '../db/schema';
import type { Db } from '../db';

export type SlackIntegration = { id: string; name: string; baseUrl: string };

// Slack Incoming Webhook の base_url（hooks.slack.com）を持つ連携をSlack通知先として扱う
export async function listSlackIntegrations(db: Db): Promise<SlackIntegration[]> {
	return db
		.select({ id: integrations.id, name: integrations.name, baseUrl: integrations.baseUrl })
		.from(integrations)
		.where(like(integrations.baseUrl, '%hooks.slack.com%'));
}

export async function getSlackIntegration(db: Db, id: string): Promise<SlackIntegration | null> {
	const rows = await listSlackIntegrations(db);
	return rows.find((r) => r.id === id) ?? null;
}
