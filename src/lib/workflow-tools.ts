// ワークフローの「アクション」ステップで選択できるツールのカタログ。
// クライアント（編集UI）・サーバー（実行エンジン）の両方から参照するため、DB等のサーバー専用依存は持たない。
import type { WorkflowResultType } from './types/chat';

export type WorkflowParamField = {
	key: string;
	label: string;
	type: 'text' | 'textarea';
	required?: boolean;
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
};

export const WORKFLOW_ACTION_TOOLS: WorkflowActionToolDef[] = [
	{
		value: 'send_email',
		label: 'メール送信（自分宛て）',
		params: [
			{ key: 'subject', label: '件名', type: 'text', required: true },
			{ key: 'body', label: '本文', type: 'textarea', required: true }
		]
	},
	{
		value: 'summarize_customers',
		label: '顧客数を集計',
		params: [],
		resultType: 'number',
		resultDesc: '顧客の総数',
		extractResult: (raw) => (raw as { total: number }).total
	}
];

export function getWorkflowActionTool(tool: string): WorkflowActionToolDef | undefined {
	return WORKFLOW_ACTION_TOOLS.find((t) => t.value === tool);
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
