import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './prompt';

// stream.ts の parseUITag が実際に解釈できる <ui type="..."> のうち、
// メインチャットから到達可能なもの一覧。
// ここに載っている種別は SYSTEM_PROMPT にも type="..." の使用例を必ず含めること。
// 含めないと、実装済みなのにAIがその存在を知らず「その機能はありません」と
// 誤答する（過去に gantt・timeline で実際に発生した不具合と同種）。
//
// 'chart' は表示を一時的に無効化中（stream.ts 参照）、'document_job' は
// build_handoff_data への移行によりメインチャットのツール一覧から除外済み
// （どちらも意図的に到達不能なため対象外）。
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
