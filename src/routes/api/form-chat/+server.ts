import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { tools, dispatchTool, type ToolEnv } from '$lib/server/mcp';
import type { StreamEvent } from '$lib/server/ai/stream';

function sse(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

// 情報取得のみ許可するツール名のセット
const READONLY_TOOL_NAMES = new Set([
	'list_integrations',
	'search_customers',
	'search_deals',
	'search_activities',
	'summarize_deals',
	'summarize_customers',
	'summarize_activities',
	'get_customer_detail',
	'get_customer_health_score',
	'get_customer_health_ranking',
	'get_customer_handover_summary',
	'get_customers',
	'get_customer',
	'get_contacts',
	'get_deals',
	'get_activities',
	'list_reminders',
	'list_entity_types',
	'get_entity_fields',
	'get_entities',
	'list_approvals',
	'get_approval',
	'get_help',
	'suggest_customer_followup'
]);

const readonlyTools = tools.filter((t) => READONLY_TOOL_NAMES.has(t.name));

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	const body = (await request.json()) as {
		message: string;
		formTitle: string;
		formFields: { key: string; label: string }[];
		history: { role: 'user' | 'assistant'; text: string }[];
	};

	if (mockMode) {
		const stream = new ReadableStream({
			async start(controller) {
				const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
				await new Promise((r) => setTimeout(r, 300));
				for (const char of 'ご質問ありがとうございます。') {
					enqueue({ type: 'delta', text: char });
					await new Promise((r) => setTimeout(r, 20));
				}
				enqueue({ type: 'done' });
				controller.close();
			}
		});
		return new Response(stream, {
			headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
		});
	}

	if (!platform?.env?.DB) {
		return json({ error: 'DB not available' }, { status: 500 });
	}

	const apiKey = platform.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};

	const fieldList = body.formFields.map((f) => `- ${f.label}（${f.key}）`).join('\n');
	const systemPrompt = `あなたは「${body.formTitle}」フォームへの入力をサポートするAIアシスタントです。
ユーザーがフォームの各フィールドを正しく入力できるよう、具体的なアドバイスや情報を提供してください。

フォームのフィールド一覧:
${fieldList}

利用可能なツール: 顧客・案件・活動・担当者などの情報を検索・取得できます。フォーム入力に必要な情報（既存の顧客名・担当者名・過去の活動内容など）をツールで調べることができます。
制約: データの登録・更新・削除・メール送信はできません。情報の取得のみ行えます。
回答は簡潔にしてください。`;

	const messages: MessageParam[] = [
		...body.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text })),
		{ role: 'user', content: body.message }
	];

	const anthropic = new Anthropic({ apiKey });

	const stream = new ReadableStream({
		async start(controller) {
			const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
			try {
				let currentMessages = messages;

				for (let turn = 0; turn < 5; turn++) {
					const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
					let currentTool: { id: string; name: string; inputJson: string } | null = null;
					let assistantText = '';

					const claudeStream = anthropic.messages.stream({
						model: 'claude-haiku-4-5-20251001',
						max_tokens: 1024,
						system: systemPrompt,
						tools: readonlyTools,
						messages: currentMessages
					});

					for await (const event of claudeStream) {
						if (event.type === 'content_block_start') {
							if (event.content_block.type === 'tool_use') {
								currentTool = { id: event.content_block.id, name: event.content_block.name, inputJson: '' };
							}
						} else if (event.type === 'content_block_delta') {
							if (event.delta.type === 'text_delta') {
								assistantText += event.delta.text;
								enqueue({ type: 'delta', text: event.delta.text });
							} else if (event.delta.type === 'input_json_delta' && currentTool) {
								currentTool.inputJson += event.delta.partial_json;
							}
						} else if (event.type === 'content_block_stop' && currentTool) {
							toolBlocks.push(currentTool);
							currentTool = null;
						}
					}

					const finalMsg = await claudeStream.finalMessage();
					if (finalMsg.stop_reason !== 'tool_use') break;

					// ツール呼び出しターン中のテキストはストリーム済みなのでそのまま継続
					const toolResults = await Promise.all(
						toolBlocks.map(async (b) => {
							try {
								const input = JSON.parse(b.inputJson || '{}');
								const result = await dispatchTool(db, b.name as never, input, toolEnv);
								return {
									type: 'tool_result' as const,
									tool_use_id: b.id,
									content: JSON.stringify(result)
								};
							} catch (e) {
								return {
									type: 'tool_result' as const,
									tool_use_id: b.id,
									content: `エラー: ${e instanceof Error ? e.message : String(e)}`,
									is_error: true
								};
							}
						})
					);

					currentMessages = [
						...currentMessages,
						{ role: 'assistant' as const, content: finalMsg.content },
						{ role: 'user' as const, content: toolResults }
					];
				}

				enqueue({ type: 'done' });
			} catch (e) {
				enqueue({ type: 'error', message: String(e) });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
	});
};
