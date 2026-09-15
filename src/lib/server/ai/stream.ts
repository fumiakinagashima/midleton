import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { buildSystemPrompt } from './prompt';
import { tools as allTools, dispatchTool } from '$lib/server/agent-tools';

// The main chat is read-only (SELECT). create_* / update_* / delete_* are run by the user via a dialog.
const WRITE_TOOL_PREFIX = ['create_', 'update_', 'delete_'];
// get_customers is a legacy tool that can only filter by name/status. Always steer the AI to
// search_customers (which supports filters) instead. (The "customer list" quick action calls
// dispatchTool directly rather than going through the AI, so excluding it here has no effect on that.)
const EXCLUDED_TOOL_NAMES = new Set(['get_customers']);
const filteredTools = allTools.filter(
	(t) =>
		!WRITE_TOOL_PREFIX.some((prefix) => t.name.startsWith(prefix)) &&
		!EXCLUDED_TOOL_NAMES.has(t.name)
);
// The tools definition is identical on every request, so put a cache breakpoint at the end
// to make it (along with the system prompt) eligible for prompt caching
const tools = filteredTools.map((t, i) =>
	i === filteredTools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t
);
import { DEFAULT_AI_MODEL } from './settings';
import type { Db } from '$lib/server/db';
import type { MessageContent } from '$lib/types/chat';
import type { ToolEnv } from '$lib/server/agent-tools';

export type StreamEvent =
	| { type: 'delta'; text: string }
	| { type: 'ui'; content: MessageContent }
	| { type: 'done' }
	| { type: 'error'; message: string };

// Processes the text stream, buffering <ui> blocks and splitting it into delta and ui events
export class TextStreamProcessor {
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

// Search tools that return a record list → the table entity type used to open the detail dialog.
// If the AI forgets to set entity in a <ui type="table"> body, we backfill it from the search tool just used.
const RECORD_LIST_TOOL_ENTITY: Record<string, string> = {
	get_customers: 'customers',
	search_customers: 'customers',
	get_contacts: 'contacts',
	get_deals: 'deals',
	search_deals: 'deals',
	get_activities: 'activities',
	search_activities: 'activities'
};

// Backfills a hinted entity onto a record-list table that didn't specify one.
// A fallback so row clicks can still open the detail dialog (only when rows have an id).
function applyEntityHint(events: StreamEvent[], entity: string | undefined): void {
	if (!entity) return;
	for (const e of events) {
		if (e.type !== 'ui' || e.content.type !== 'table' || e.content.entity) continue;
		const first = e.content.rows[0];
		if (e.content.rows.length > 0 && first && typeof first === 'object' && 'id' in first) {
			e.content.entity = entity;
		}
	}
}

export function parseUITag(tag: string): MessageContent | null {
	const attrStr = /^<ui\s([^>]*)>/.exec(tag)?.[1] ?? '';
	const body = tag.replace(/^<ui[^>]*>/, '').replace(/<\/ui>$/, '').trim();
	const type = /type="([^"]+)"/.exec(attrStr)?.[1];
	const title = /title="([^"]+)"/.exec(attrStr)?.[1];
	const name = /name="([^"]+)"/.exec(attrStr)?.[1];
	const id = /id="([^"]+)"/.exec(attrStr)?.[1];
	const tool = /tool="([^"]+)"/.exec(attrStr)?.[1];
	const entity = /entity="([^"]+)"/.exec(attrStr)?.[1];
	const submitLabel = /submitLabel="([^"]+)"/.exec(attrStr)?.[1];
	const chartType = /chartType="([^"]+)"/.exec(attrStr)?.[1] as 'bar' | 'line' | 'pie' | undefined;
	const chartMode = /mode="([^"]+)"/.exec(attrStr)?.[1] as 'normal' | 'stacked' | 'grouped' | undefined;
	const href = /href="([^"]+)"/.exec(attrStr)?.[1];
	const label = /label="([^"]+)"/.exec(attrStr)?.[1];
	const description = /description="([^"]+)"/.exec(attrStr)?.[1];
	const newTab = /newTab="([^"]+)"/.exec(attrStr)?.[1] === 'true';
	const jobId = /jobId="([^"]+)"/.exec(attrStr)?.[1];
	const downloadUrl = /downloadUrl="([^"]+)"/.exec(attrStr)?.[1];
	const filename = /filename="([^"]+)"/.exec(attrStr)?.[1];

	try {
		if (type === 'form' && (tool || entity)) {
			return { type: 'form', title, fields: body ? JSON.parse(body) : [], tool: tool ?? '', entity, submitLabel };
		} else if (type === 'table') {
			const { columns, rows, entity } = JSON.parse(body);
			return { type: 'table', columns, rows, entity };
		} else if (type === 'actions') {
			return { type: 'actions', title, actions: JSON.parse(body) };
		} else if (type === 'values') {
			return { type: 'values', title, items: JSON.parse(body) };
		} else if (type === 'gantt') {
			const opts = body ? JSON.parse(body) : {};
			return { type: 'gantt', title, filter: opts.filter };
		} else if (type === 'timeline') {
			const opts = body ? JSON.parse(body) : {};
			return { type: 'timeline', title, filter: opts.filter };
		} else if (type === 'chart') {
			// chart display is temporarily disabled
			return null;
		} else if (type === 'kanban') {
			const { columns, cards } = JSON.parse(body);
			return { type: 'kanban', title, columns, cards };
		} else if (type === 'link' && href && label) {
			return { type: 'link', label, href, description, newTab: newTab || undefined };
		} else if (type === 'bizcard') {
			return { type: 'bizcard', title };
		} else if (type === 'document_job' && jobId && label) {
			return { type: 'document_job', jobId, label };
		} else if (type === 'doc_handoff' && downloadUrl && filename && label) {
			return { type: 'doc_handoff', label, downloadUrl, filename, prompt: body };
		} else if (type === 'reply') {
			return { type: 'reply', title, fields: JSON.parse(body), submitLabel };
		} else if (type === 'customer_detail') {
			const { customer, contacts, deals, activities } = JSON.parse(body);
			return { type: 'customer_detail', customer, contacts, deals, activities };
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
	env?: ToolEnv,
	ctx?: ExecutionContext
): Promise<void> {
	const anthropic = new Anthropic({ apiKey });
	let messages: MessageParam[] = [...history];
	let lastTurnEvents: StreamEvent[] = [];
	// Tracks entity per turn.
	// Remembers the entity of the most recent turn that used only a single entity type, and uses
	// it as the fallback for entity-less tables on the final turn.
	// If a turn used multiple entities, this becomes undefined (ambiguous, so no backfill).
	// e.g. for a two-turn search_customers → search_deals sequence, the later turn's 'deals' sticks.
	let hintEntity: string | undefined;

	for (let turn = 0; turn < 10; turn++) {
		const processor = new TextStreamProcessor();
		const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
		let currentTool: { id: string; name: string; inputJson: string } | null = null;
		const turnEvents: StreamEvent[] = [];

		const stream = anthropic.messages.stream({
			model: model ?? DEFAULT_AI_MODEL,
			max_tokens: 8192,
			system: buildSystemPrompt(),
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

		// Collect the entity of any record-list tools used in this turn
		const turnEntities = new Set<string>();
		for (const b of toolBlocks) {
			const ent = RECORD_LIST_TOOL_ENTITY[b.name];
			if (ent) turnEntities.add(ent);
		}
		// Update hintEntity: if exactly one, use it; if more than one, ambiguous (undefined); if zero, keep the previous value
		if (turnEntities.size === 1) {
			hintEntity = [...turnEntities][0];
		} else if (turnEntities.size > 1) {
			hintEntity = undefined;
		}

		const finalMsg = await stream.finalMessage();
		if (finalMsg.stop_reason !== 'tool_use') {
			applyEntityHint(turnEvents, hintEntity);
			for (const e of turnEvents) emit(e);
			return;
		}

		// Text/UI from an intermediate turn that involves a tool call is just progress narration, so it's never shown to the user

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
						content: `Error: ${e instanceof Error ? e.message : String(e)}`,
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

	// If the turn limit is reached, show the content of the last turn
	applyEntityHint(lastTurnEvents, hintEntity);
	for (const e of lastTurnEvents) emit(e);
}
