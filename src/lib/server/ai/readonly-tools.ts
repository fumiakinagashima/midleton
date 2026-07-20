import { tools } from '$lib/server/agent-tools';

// 情報取得のみ許可するツール名のセット。フォーム入力サポート・ワークフロー構築サポートなど、
// データの登録・更新・削除を行わせたくない補助チャットで共有する。
// get_customers は含めない（name/status しか絞り込めない下位互換ツール。顧客一覧・検索は search_customers に一本化する）
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
