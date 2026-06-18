// ワークフローの「アクション」ステップで選択できるツールのカタログ。
// クライアント（編集UI）・サーバー（実行エンジン）の両方から参照するため、DB等のサーバー専用依存は持たない。
import type { WorkflowResultType } from './types/chat';

export type WorkflowParamField = {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'number' | 'select' | 'date';
	required?: boolean;
	/** type: 'select' の場合の選択肢 */
	options?: { value: string; label: string }[];
};

export type WorkflowActionToolDef = {
	value: string;
	label: string;
	/** ユーザーが入力するパラメータ（自動補完される値、例: send_email の to は含めない） */
	params: WorkflowParamField[];
	/** 条件・他ステップの引数から参照可能なスカラー結果を返す場合に指定する */
	resultType?: WorkflowResultType;
	resultDesc?: string;
	/** ツールの生の戻り値からスカラー結果を取り出す（resultType指定時は必須） */
	extractResult?: (raw: unknown) => boolean | number | string;
	/** AIへの説明文に添える補足（自動補完される値の説明など）。UI上には表示しない */
	note?: string;
};

export const WORKFLOW_ACTION_TOOLS: WorkflowActionToolDef[] = [
	{
		value: 'send_email',
		label: 'メール送信（自分宛て）',
		params: [
			{ key: 'subject', label: '件名', type: 'text', required: true },
			{ key: 'body', label: '本文', type: 'textarea', required: true }
		],
		note: '宛先は自動でユーザー自身のメールアドレスになる（to パラメータは不要）'
	},
	{
		value: 'summarize_customers',
		label: '顧客数を集計',
		params: [],
		resultType: 'number',
		resultDesc: '顧客の総数',
		extractResult: (raw) => (raw as { total: number }).total
	},
	{
		value: 'search_customers',
		label: '顧客を検索',
		params: [
			{ key: 'name', label: '顧客名（部分一致）', type: 'text' },
			{
				key: 'status',
				label: 'ステータス',
				type: 'select',
				options: [
					{ value: '', label: '指定しない' },
					{ value: 'active', label: '有効' },
					{ value: 'inactive', label: '無効' }
				]
			},
			{ key: 'limit', label: '取得件数の上限', type: 'number' }
		],
		resultType: 'number',
		resultDesc: '該当する顧客の件数',
		extractResult: (raw) => (Array.isArray(raw) ? raw.length : 0)
	},
	{
		value: 'summarize_deals',
		label: '案件を集計',
		params: [
			{ key: 'since', label: '集計開始日', type: 'date' },
			{ key: 'until', label: '集計終了日', type: 'date' },
			{
				key: 'date_field',
				label: '期間の基準日',
				type: 'select',
				options: [
					{ value: 'created_at', label: '登録日' },
					{ value: 'closed_at', label: '成約/失注日' }
				]
			}
		],
		resultType: 'number',
		resultDesc: '該当する案件の総件数',
		extractResult: (raw) => (raw as { total: { count: number } }).total.count
	},
	{
		value: 'summarize_activities',
		label: '活動履歴を集計',
		params: [
			{ key: 'since', label: '集計開始日', type: 'date' },
			{ key: 'until', label: '集計終了日', type: 'date' }
		],
		resultType: 'number',
		resultDesc: '該当する活動履歴の総件数',
		extractResult: (raw) => (raw as { total: number }).total
	}
];

export function getWorkflowActionTool(tool: string): WorkflowActionToolDef | undefined {
	return WORKFLOW_ACTION_TOOLS.find((t) => t.value === tool);
}

const RESULT_TYPE_LABELS: Record<WorkflowResultType, string> = {
	boolean: '真偽値',
	number: '数値',
	string: '文字列'
};

/** AIへのシステムプロンプトに埋め込む、カタログ1件分の説明文を生成する。 */
export function describeWorkflowActionToolForAI(t: WorkflowActionToolDef): string {
	const paramsDesc =
		t.params.length > 0
			? JSON.stringify(Object.fromEntries(t.params.map((p) => [p.key, p.label])))
			: 'params不要';
	const resultDesc = t.resultType
		? `、結果は${RESULT_TYPE_LABELS[t.resultType]}${t.resultDesc ? `（${t.resultDesc}）` : ''}`
		: '';
	const noteDesc = t.note ? `※${t.note}` : '';
	return `- \`${t.value}\`（${t.label}${resultDesc}）: params = ${paramsDesc}${noteDesc ? ` ${noteDesc}` : ''}`;
}

export const WORKFLOW_OPERATORS: { value: string; label: string }[] = [
	{ value: '==', label: '＝' },
	{ value: '!=', label: '≠' },
	{ value: '>', label: '＞' },
	{ value: '<', label: '＜' },
	{ value: '>=', label: '≧' },
	{ value: '<=', label: '≦' }
];

const STEP_REF_PREFIX = '@step:';

export function makeStepRef(id: string): string {
	return `${STEP_REF_PREFIX}${id}`;
}

export function parseStepRef(value: string | undefined): string | null {
	if (!value || !value.startsWith(STEP_REF_PREFIX)) return null;
	return value.slice(STEP_REF_PREFIX.length);
}
