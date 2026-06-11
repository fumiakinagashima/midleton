import type { Db } from '../db';
import { dispatchTool, type ToolName } from '../mcp';
import type { MessageContent } from '$lib/types/chat';
import type { QuickActionId } from '$lib/quick-actions/catalog';

const DEAL_STATUS_LABEL: Record<string, string> = { open: '進行中', won: '受注', lost: '失注' };
const CUSTOMER_STATUS_LABEL: Record<string, string> = { active: 'アクティブ', inactive: '非アクティブ' };
const ACTIVITY_TYPE_LABEL: Record<string, string> = { note: 'メモ', call: '通話', email: 'メール', meeting: '面談' };
const APPROVAL_STATUS_LABEL: Record<string, string> = {
	pending: '審査中',
	approved: '承認済',
	rejected: '否決',
	cancelled: '取消'
};

function yen(amount: unknown): string {
	if (amount === null || amount === undefined || amount === '') return '—';
	const num = typeof amount === 'string' ? Number(amount) : (amount as number);
	if (Number.isNaN(num)) return '—';
	return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num);
}

type ToolQuickActionHandler = {
	tool: ToolName;
	input?: Record<string, unknown>;
	format: (result: unknown) => MessageContent[];
};

type StaticQuickActionHandler = {
	contents: MessageContent[];
};

type QuickActionHandler = ToolQuickActionHandler | StaticQuickActionHandler;

function isToolHandler(handler: QuickActionHandler): handler is ToolQuickActionHandler {
	return 'tool' in handler;
}

const handlers: Record<QuickActionId, QuickActionHandler> = {
	get_customers: {
		tool: 'get_customers',
		input: { limit: 10 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: '顧客が登録されていません。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'name', label: '会社名' },
						{ key: 'email', label: 'メール' },
						{ key: 'phone', label: '電話番号' },
						{ key: 'statusLabel', label: 'ステータス' }
					],
					rows: rows.map((r) => ({ ...r, statusLabel: CUSTOMER_STATUS_LABEL[r.status as string] ?? r.status }))
				}
			];
		}
	},

	search_deals: {
		tool: 'search_deals',
		input: { limit: 10 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: '案件が登録されていません。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'title', label: '案件名' },
						{ key: 'customerName', label: '顧客' },
						{ key: 'amountLabel', label: '金額' },
						{ key: 'statusLabel', label: 'ステータス' }
					],
					rows: rows.map((r) => ({
						...r,
						amountLabel: yen(r.amount),
						statusLabel: DEAL_STATUS_LABEL[r.status as string] ?? r.status
					}))
				}
			];
		}
	},

	deals_kanban: {
		tool: 'search_deals',
		input: { limit: 50 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: '案件が登録されていません。' }];
			return [
				{
					type: 'kanban',
					title: '案件パイプライン',
					columns: Object.entries(DEAL_STATUS_LABEL).map(([id, label]) => ({ id, label })),
					cards: rows.map((r) => ({
						id: r.id as string,
						title: r.title as string,
						subtitle: r.customerName as string | undefined,
						amount: (r.amount as number | null) ?? undefined,
						columnId: r.status as string
					}))
				}
			];
		}
	},

	get_contacts: {
		tool: 'get_contacts',
		input: { limit: 10 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: '担当者が登録されていません。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'name', label: '氏名' },
						{ key: 'role', label: '役職' },
						{ key: 'department', label: '部署' },
						{ key: 'email', label: 'メール' }
					],
					rows
				}
			];
		}
	},

	list_approvals: {
		tool: 'list_approvals',
		input: {},
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: '申請はありません。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'title', label: 'タイトル' },
						{ key: 'submittedBy', label: '申請者' },
						{ key: 'statusLabel', label: 'ステータス' }
					],
					rows: rows.map((r) => ({ ...r, statusLabel: APPROVAL_STATUS_LABEL[r.status as string] ?? r.status }))
				}
			];
		}
	},

	list_entity_types: {
		tool: 'list_entity_types',
		input: {},
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: 'カスタムテーブルはまだありません。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'icon', label: '' },
						{ key: 'label', label: 'テーブル名' },
						{ key: 'name', label: '識別名' }
					],
					rows
				}
			];
		}
	},

	summarize_deals: {
		tool: 'summarize_deals',
		input: {},
		format: (result) => {
			const { by_status } = result as {
				by_status: Record<string, { count: number; total_amount: number; avg_amount: number }>;
			};
			const entries = Object.entries(by_status);
			if (entries.length === 0) return [{ type: 'text', text: '案件が登録されていません。' }];
			return [
				{
					type: 'chart',
					chartType: 'bar',
					title: 'ステータス別 案件金額',
					data: entries.map(([status, v]) => ({ label: DEAL_STATUS_LABEL[status] ?? status, value: v.total_amount }))
				},
				{
					type: 'values',
					title: '案件件数',
					items: entries.map(([status, v]) => ({
						label: DEAL_STATUS_LABEL[status] ?? status,
						value: v.count,
						format: 'number'
					}))
				}
			];
		}
	},

	summarize_customers: {
		tool: 'summarize_customers',
		input: {},
		format: (result) => {
			const { total, by_status } = result as { total: number; by_status: Record<string, number> };
			const entries = Object.entries(by_status);
			if (entries.length === 0) return [{ type: 'text', text: '顧客が登録されていません。' }];
			return [
				{
					type: 'values',
					title: '顧客数',
					items: [
						{ label: '合計', value: total, format: 'number' },
						...entries.map(([status, count]) => ({
							label: CUSTOMER_STATUS_LABEL[status] ?? status,
							value: count,
							format: 'number' as const
						}))
					]
				}
			];
		}
	},

	summarize_activities: {
		tool: 'summarize_activities',
		input: {},
		format: (result) => {
			const { by_type } = result as { total: number; by_type: Record<string, number> };
			const entries = Object.entries(by_type);
			if (entries.length === 0) return [{ type: 'text', text: '活動履歴がありません。' }];
			return [
				{
					type: 'chart',
					chartType: 'bar',
					title: '種別ごとの活動件数',
					data: entries.map(([type, count]) => ({ label: ACTIVITY_TYPE_LABEL[type] ?? type, value: count }))
				}
			];
		}
	},

	create_customer: {
		contents: [
			{
				type: 'form',
				title: '顧客情報登録',
				tool: 'create_customer',
				fields: [
					{ key: 'name', label: '会社名', type: 'text', required: true },
					{ key: 'email', label: 'メールアドレス', type: 'email' },
					{ key: 'phone', label: '電話番号', type: 'tel' },
					{ key: 'postal_code', label: '郵便番号', type: 'text' },
					{ key: 'address', label: '住所', type: 'text' },
					{ key: 'website', label: 'ホームページ', type: 'text' },
					{
						key: 'status',
						label: 'ステータス',
						type: 'select',
						options: [
							{ label: 'アクティブ', value: 'active' },
							{ label: '非アクティブ', value: 'inactive' }
						]
					},
					{ key: 'notes', label: '備考', type: 'textarea' }
				]
			}
		]
	},

	scan_bizcard: {
		contents: [{ type: 'bizcard', title: '名刺を読み取ってください' }]
	}
};

export async function runQuickAction(db: Db, id: QuickActionId): Promise<MessageContent[]> {
	const handler = handlers[id];
	if (!isToolHandler(handler)) return handler.contents;
	const result = await dispatchTool(db, handler.tool, handler.input ?? {});
	return handler.format(result);
}
