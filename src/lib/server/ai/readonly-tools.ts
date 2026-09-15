import { tools } from '$lib/server/agent-tools';

// Set of tool names that are allowed for read-only access. Shared by auxiliary chats (e.g. form
// input assistance, workflow-building assistance) where we don't want to allow creating, updating,
// or deleting data.
// get_customers is intentionally excluded (a legacy tool that can only filter by name/status;
// customer listing/search is consolidated into search_customers)
export const READONLY_TOOL_NAMES = new Set([
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
	'get_customer',
	'get_contacts',
	'get_deals',
	'get_activities',
	'list_reminders',
	'get_help',
	'suggest_customer_followup'
]);

export const readonlyTools = tools.filter((t) => READONLY_TOOL_NAMES.has(t.name));
