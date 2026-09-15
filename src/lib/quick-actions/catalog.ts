// Quick actions: a catalog of agent tools that can be invoked directly from the "+" button
// in the chat input, bypassing the AI. Shared with the client (chat input, settings screen),
// so it must not have server-only dependencies (DB, dispatchTool, etc.).

export type QuickActionId =
	| 'get_customers'
	| 'search_deals'
	| 'get_contacts'
	| 'summarize_deals'
	| 'summarize_customers'
	| 'summarize_activities'
	| 'create_customer'
	| 'scan_bizcard'
	| 'create_reminder'
	| 'ai_briefing';

export type QuickActionDef = {
	id: QuickActionId;
	label: string;
	description: string;
	icon: string;
};

export const quickActionCatalog: QuickActionDef[] = [
	{ id: 'get_customers', label: 'Customer list', description: 'Shows the latest list of customers', icon: '👥' },
	{ id: 'search_deals', label: 'Deal list', description: 'Shows the latest list of deals', icon: '💼' },
	{ id: 'get_contacts', label: 'Contact list', description: 'Shows the latest list of contacts', icon: '🧑' },
	{ id: 'summarize_deals', label: 'Deal summary', description: 'Shows deal counts and amounts by status', icon: '📊' },
	{ id: 'summarize_customers', label: 'Customer summary', description: 'Shows customer counts by status', icon: '📈' },
	{ id: 'summarize_activities', label: 'Activity summary', description: 'Shows activity counts by type', icon: '📝' },
	{ id: 'create_customer', label: 'New customer', description: 'Shows the customer registration form', icon: '➕' },
	{ id: 'scan_bizcard', label: 'Scan business card', description: 'Scans a business card to register a customer and contact', icon: '📇' },
	{ id: 'create_reminder', label: 'Set reminder', description: 'Shows the reminder registration form', icon: '⏰' },
	{ id: 'ai_briefing', label: 'AI briefing', description: 'AI summarizes deals recommended for follow-up today and reminders', icon: '✨' }
];

export const DEFAULT_QUICK_ACTION_IDS: QuickActionId[] = [
	'get_customers',
	'search_deals',
	'summarize_deals',
	'summarize_activities'
];

export const MAX_QUICK_ACTIONS = 5;

export const QUICK_ACTIONS_STORAGE_KEY = 'quickActionIds';

export function isQuickActionId(id: string): id is QuickActionId {
	return quickActionCatalog.some((a) => a.id === id);
}
