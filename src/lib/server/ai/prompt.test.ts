import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './prompt';

// The <ui type="..."> values that parseUITag in stream.ts can actually parse and that are
// reachable from the main chat.
// Every type listed here must have a usage example with type="..." in SYSTEM_PROMPT.
// Otherwise, even though the feature is implemented, the AI won't know it exists and will
// incorrectly answer "that feature doesn't exist" (this actually happened for gantt and
// timeline in the past).
//
// 'chart' has its display temporarily disabled (see stream.ts), and 'document_job' has been
// removed from the main chat's tool list in favor of build_handoff_data
// (both are intentionally unreachable, so they're excluded here).
const RENDERABLE_UI_TYPES = [
	'form',
	'table',
	'actions',
	'values',
	'gantt',
	'timeline',
	'kanban',
	'link',
	'bizcard',
	'doc_handoff',
	'reply',
	'customer_detail'
] as const;

describe('SYSTEM_PROMPT documents every renderable UI type', () => {
	it.each(RENDERABLE_UI_TYPES)('mentions <ui type="%s"> with a usage example', (type) => {
		expect(SYSTEM_PROMPT).toContain(`type="${type}"`);
	});
});
