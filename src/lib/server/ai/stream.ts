import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { SYSTEM_PROMPT } from './prompt';
import { tools, dispatchTool } from '$lib/server/mcp';
import type { Db } from '$lib/server/db';
import type { MessageContent } from '$lib/types/chat';
import type { EmailEnv } from '$lib/server/email';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export type StreamEvent =
	| { type: 'delta'; text: string }
	| { type: 'ui'; content: MessageContent }
	| { type: 'done' }
	| { type: 'error'; message: string };

// テキストストリームを処理し、<ui>ブロックをバッファリングしてdeltaとuiイベントに分離
class TextStreamProcessor {
	private buf = '';
	private inUi = false;

	process(chunk: string): StreamEvent[] {
		this.buf += chunk;
		const events: StreamEvent[] = [];

		while (this.buf.length > 0) {
			if (!this.inUi) {
				const start = this.buf.indexOf('<ui');
				if (start === -1) {
					events.push({ type: 'delta', text: this.buf });
					this.buf = '';
					break;
				}
				if (start > 0) {
					events.push({ type: 'delta', text: this.buf.slice(0, start) });
				}
				this.buf = this.buf.slice(start);
				this.inUi = true;
			} else {
				const end = this.buf.indexOf('</ui>');
				if (end === -1) break;
				const tag = this.buf.slice(0, end + 5);
				this.buf = this.buf.slice(end + 5);
				this.inUi = false;
				const parsed = parseUITag(tag);
				if (parsed) events.push({ type: 'ui', content: parsed });
			}
		}

		return events;
	}

	flush(): StreamEvent[] {
		if (!this.inUi && this.buf) {
			const ev: StreamEvent = { type: 'delta', text: this.buf };
			this.buf = '';
			return [ev];
		}
		this.buf = '';
		this.inUi = false;
		return [];
	}
}

function parseUITag(tag: string): MessageContent | null {
	const attrStr = /^<ui\s([^>]*)>/.exec(tag)?.[1] ?? '';
	const body = tag.replace(/^<ui[^>]*>/, '').replace(/<\/ui>$/, '').trim();
	const type = /type="([^"]+)"/.exec(attrStr)?.[1];
	const title = /title="([^"]+)"/.exec(attrStr)?.[1];
	const tool = /tool="([^"]+)"/.exec(attrStr)?.[1];
	const submitLabel = /submitLabel="([^"]+)"/.exec(attrStr)?.[1];
	const chartType = /chartType="([^"]+)"/.exec(attrStr)?.[1] as 'bar' | 'line' | 'pie' | undefined;
	const chartMode = /mode="([^"]+)"/.exec(attrStr)?.[1] as 'normal' | 'stacked' | 'grouped' | undefined;
	const href = /href="([^"]+)"/.exec(attrStr)?.[1];
	const label = /label="([^"]+)"/.exec(attrStr)?.[1];
	const description = /description="([^"]+)"/.exec(attrStr)?.[1];
	const newTab = /newTab="([^"]+)"/.exec(attrStr)?.[1] === 'true';
	const jobId = /jobId="([^"]+)"/.exec(attrStr)?.[1];

	try {
		if (type === 'form' && tool) {
			return { type: 'form', title, fields: JSON.parse(body), tool, submitLabel };
		} else if (type === 'table') {
			const { columns, rows } = JSON.parse(body);
			return { type: 'table', columns, rows };
		} else if (type === 'actions') {
			return { type: 'actions', title, actions: JSON.parse(body) };
		} else if (type === 'values') {
			return { type: 'values', title, items: JSON.parse(body) };
		} else if (type === 'gantt') {
			const opts = body ? JSON.parse(body) : {};
			return { type: 'gantt', title, filter: opts.filter };
		} else if (type === 'chart') {
			const parsed = JSON.parse(body);
			const isSeries = Array.isArray(parsed) && parsed[0] && 'data' in parsed[0];
			return {
				type: 'chart',
				chartType: chartType ?? 'bar',
				title,
				mode: chartMode,
				...(isSeries ? { series: parsed } : { data: parsed })
			};
		} else if (type === 'kanban') {
			const { columns, cards } = JSON.parse(body);
			return { type: 'kanban', title, columns, cards };
		} else if (type === 'link' && href && label) {
			return { type: 'link', label, href, description, newTab: newTab || undefined };
		} else if (type === 'bizcard') {
			return { type: 'bizcard', title };
		} else if (type === 'document_job' && jobId && label) {
			return { type: 'document_job', jobId, label };
		}
	} catch {
		// malformed JSON in UI tag
	}
	return null;
}

export async function streamChat(
	db: Db,
	apiKey: string,
	history: MessageParam[],
	model: string | undefined,
	emit: (event: StreamEvent) => void,
	env?: EmailEnv,
	ctx?: ExecutionContext
): Promise<void> {
	const anthropic = new Anthropic({ apiKey });
	let messages: MessageParam[] = [...history];
	let lastTurnEvents: StreamEvent[] = [];

	for (let turn = 0; turn < 10; turn++) {
		const processor = new TextStreamProcessor();
		const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
		let currentTool: { id: string; name: string; inputJson: string } | null = null;
		const turnEvents: StreamEvent[] = [];

		const stream = anthropic.messages.stream({
			model: model ?? DEFAULT_MODEL,
			max_tokens: 8192,
			system: SYSTEM_PROMPT,
			tools,
			messages
		});

		for await (const event of stream) {
			if (event.type === 'content_block_start') {
				if (event.content_block.type === 'tool_use') {
					currentTool = { id: event.content_block.id, name: event.content_block.name, inputJson: '' };
				}
			} else if (event.type === 'content_block_delta') {
				if (event.delta.type === 'text_delta') {
					turnEvents.push(...processor.process(event.delta.text));
				} else if (event.delta.type === 'input_json_delta' && currentTool) {
					currentTool.inputJson += event.delta.partial_json;
				}
			} else if (event.type === 'content_block_stop' && currentTool) {
				toolBlocks.push(currentTool);
				currentTool = null;
			}
		}

		turnEvents.push(...processor.flush());
		lastTurnEvents = turnEvents;

		const finalMsg = await stream.finalMessage();
		if (finalMsg.stop_reason !== 'tool_use') {
			for (const e of turnEvents) emit(e);
			return;
		}

		// ツール呼び出しを伴う中間ターンのテキスト・UIは進行状況の実況なのでユーザーには表示しない

		const toolResults = await Promise.all(
			toolBlocks.map(async (b) => {
				try {
					const input = JSON.parse(b.inputJson || '{}');
					const result = await dispatchTool(db, b.name as never, input, env, ctx);
					return { type: 'tool_result' as const, tool_use_id: b.id, content: JSON.stringify(result) };
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

		messages = [
			...messages,
			{ role: 'assistant' as const, content: finalMsg.content },
			{ role: 'user' as const, content: toolResults }
		];
	}

	// ターン上限に達した場合は最後のターンの内容を表示する
	for (const e of lastTurnEvents) emit(e);
}
