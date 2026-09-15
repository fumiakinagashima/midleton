import type { Db } from '../db';
import { dispatchTool, type ToolName, type ToolEnv } from '../agent-tools';
import { getReminderChannelOptions } from '../db/reminder-service';
import { getCachedBriefing, computeBriefing } from '../ai/briefing';
import type { MessageContent } from '$lib/types/chat';
import type { QuickActionId } from '$lib/quick-actions/catalog';

const DEAL_STATUS_LABEL: Record<string, string> = { open: 'In Progress', won: 'Won', lost: 'Lost' };
const CUSTOMER_STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive' };
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
	note: 'Note',
	call: 'Call',
	email: 'Email',
	meeting: 'Meeting',
	deal_created: 'Deal Registered'
};

function yen(amount: unknown): string {
	if (amount === null || amount === undefined || amount === '') return '—';
	const num = typeof amount === 'string' ? Number(amount) : (amount as number);
	if (Number.isNaN(num)) return '—';
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'JPY' }).format(num);
}

type ToolQuickActionHandler = {
	tool: ToolName;
	input?: Record<string, unknown>;
	format: (result: unknown) => MessageContent[];
};

type StaticQuickActionHandler = {
	contents: MessageContent[];
};

type DynamicQuickActionHandler = {
	build: (db: Db, env?: ToolEnv) => Promise<MessageContent[]>;
};

type QuickActionHandler = ToolQuickActionHandler | StaticQuickActionHandler | DynamicQuickActionHandler;

function isToolHandler(handler: QuickActionHandler): handler is ToolQuickActionHandler {
	return 'tool' in handler;
}

function isDynamicHandler(handler: QuickActionHandler): handler is DynamicQuickActionHandler {
	return 'build' in handler;
}

const handlers: Record<QuickActionId, QuickActionHandler> = {
	get_customers: {
		tool: 'get_customers',
		input: { limit: 100 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: 'No customers are registered.' }];
			return [
				{
					type: 'table',
					entity: 'customers',
					columns: [
						{ key: 'name', label: 'Company Name' },
						{ key: 'email', label: 'Email' },
						{ key: 'phone', label: 'Phone' },
						{ key: 'statusLabel', label: 'Status' }
					],
					rows: rows.map((r) => ({ ...r, statusLabel: CUSTOMER_STATUS_LABEL[r.status as string] ?? r.status }))
				}
			];
		}
	},

	search_deals: {
		tool: 'search_deals',
		input: { limit: 100 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: 'No deals are registered.' }];
			return [
				{
					type: 'table',
					entity: 'deals',
					columns: [
						{ key: 'title', label: 'Deal Name' },
						{ key: 'customerName', label: 'Customer' },
						{ key: 'amountLabel', label: 'Amount' },
						{ key: 'statusLabel', label: 'Status' }
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

	get_contacts: {
		tool: 'get_contacts',
		input: { limit: 100 },
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: 'No contacts are registered.' }];
			return [
				{
					type: 'table',
					entity: 'contacts',
					columns: [
						{ key: 'name', label: 'Name' },
						{ key: 'role', label: 'Title' },
						{ key: 'department', label: 'Department' },
						{ key: 'email', label: 'Email' }
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
			if (entries.length === 0) return [{ type: 'text', text: 'No deals are registered.' }];
			return [
				{
					type: 'chart',
					chartType: 'bar',
					title: 'Deal Amount by Status',
					data: entries.map(([status, v]) => ({ label: DEAL_STATUS_LABEL[status] ?? status, value: v.total_amount }))
				},
				{
					type: 'values',
					title: 'Deal Count',
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
			if (entries.length === 0) return [{ type: 'text', text: 'No customers are registered.' }];
			return [
				{
					type: 'values',
					title: 'Customer Count',
					items: [
						{ label: 'Total', value: total, format: 'number' },
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
			if (entries.length === 0) return [{ type: 'text', text: 'No activity history.' }];
			return [
				{
					type: 'chart',
					chartType: 'bar',
					title: 'Activity Count by Type',
					data: entries.map(([type, count]) => ({ label: ACTIVITY_TYPE_LABEL[type] ?? type, value: count }))
				}
			];
		}
	},

	create_customer: {
		contents: [
			{
				type: 'form',
				title: 'Register Customer Information',
				tool: 'create_customer',
				fields: [
					{ key: 'name', label: 'Company Name', type: 'text', required: true },
					{ key: 'email', label: 'Email Address', type: 'email' },
					{ key: 'phone', label: 'Phone', type: 'tel' },
					{ key: 'postal_code', label: 'Postal Code', type: 'text' },
					{ key: 'address', label: 'Address', type: 'text' },
					{ key: 'website', label: 'Website', type: 'text' },
					{
						key: 'status',
						label: 'Status',
						type: 'select',
						value: 'active',
						options: [
							{ label: 'Active', value: 'active' },
							{ label: 'Inactive', value: 'inactive' }
						]
					},
					{ key: 'notes', label: 'Notes', type: 'textarea' }
				]
			}
		]
	},

	scan_bizcard: {
		contents: [{ type: 'bizcard', title: 'Please scan a business card' }]
	},

	create_reminder: {
		build: async (db, env) => {
			const options = await getReminderChannelOptions(db, env);
			return [
				{
					type: 'form',
					title: 'Set a Reminder',
					tool: 'create_reminder',
					fields: [
						{ key: 'remind_at', label: 'Date/Time', type: 'datetime-local', required: true },
						{
							key: 'channels',
							label: 'Notify Via',
							type: 'multiselect',
							required: true,
							value: 'notification',
							options
						},
						{ key: 'content', label: 'Content', type: 'textarea', required: true }
					]
				}
			];
		}
	},

	ai_briefing: {
		build: async (db, env) => {
			const accountId = env?.accountId ?? null;
			const cached = await getCachedBriefing(db, accountId);
			if (cached) return cached;
			const apiKey = env?.ANTHROPIC_API_KEY ?? '';
			if (!apiKey) return [{ type: 'text', text: 'ANTHROPIC_API_KEY is not configured.' }];
			return computeBriefing(db, accountId, apiKey);
		}
	}
};

export async function runQuickAction(db: Db, id: QuickActionId, env?: ToolEnv): Promise<MessageContent[]> {
	const handler = handlers[id];
	if (isDynamicHandler(handler)) return handler.build(db, env);
	if (!isToolHandler(handler)) return handler.contents;
	const result = await dispatchTool(db, handler.tool, handler.input ?? {});
	return handler.format(result);
}
