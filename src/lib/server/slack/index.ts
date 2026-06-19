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

export type SlackIntegrationOption = { id: string; name: string };

/** ワークフローの「Slack」対象選択用に、webhook URL（baseUrl）を含まない一覧を取得する。 */
export async function listSlackIntegrationsForWorkflow(db: Db): Promise<SlackIntegrationOption[]> {
	return (await listSlackIntegrations(db)).map((s) => ({ id: s.id, name: s.name }));
}

export async function sendSlackMessage(integration: SlackIntegration, text: string): Promise<void> {
	const res = await fetch(integration.baseUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text })
	});
	if (!res.ok) {
		throw new Error(`Slack通知の送信に失敗しました（${integration.name}）: ${res.status}`);
	}
}
