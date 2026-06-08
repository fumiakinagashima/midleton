import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { chat } from '$lib/server/ai/client';
import { createDb } from '$lib/server/db';
import { dispatchTool } from '$lib/server/mcp';
import type { Message, MessageContent } from '$lib/types/chat';

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) {
		return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });
	}

	if (!platform?.env?.DB) {
		return json({ error: 'D1データベースが設定されていません。wrangler dev で起動してください。' }, { status: 500 });
	}

	const db = createDb(platform.env.DB);
	const body = await request.json() as {
		message?: string;
		tool?: string;
		data?: Record<string, string>;
		history?: Message[];
	};

	// フォーム送信（tool + data）
	if (body.tool && body.data) {
		try {
			const result = await dispatchTool(db, body.tool as never, body.data);
			const contents: MessageContent[] = [
				{ type: 'text', text: `登録が完了しました。` },
				{
					type: 'table',
					columns: Object.keys(result as object).map((key) => ({ key, label: key })),
					rows: [result as Record<string, unknown>]
				}
			];
			return json({ contents });
		} catch (e) {
			return json({
				contents: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }]
			});
		}
	}

	// チャットメッセージ
	const userMessage = body.message?.trim() ?? '';
	if (!userMessage) {
		return json({ error: 'メッセージが空です。' }, { status: 400 });
	}

	const history: MessageParam[] = (body.history ?? [])
		.filter((m) => m.role === 'user' || m.role === 'assistant')
		.flatMap((m): MessageParam[] => {
			const text = m.contents
				.filter((c) => c.type === 'text')
				.map((c) => (c.type === 'text' ? c.text : ''))
				.join('\n')
				.trim();
			if (!text) return [];
			return [{ role: m.role as 'user' | 'assistant', content: text }];
		});

	history.push({ role: 'user', content: userMessage });

	const contents = await chat(db, apiKey, history);
	return json({ contents });
};
