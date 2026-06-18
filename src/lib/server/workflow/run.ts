import type { Db } from '../db';
import type { ToolEnv } from '../mcp/shared';
import { dispatchTool, type ToolName } from '../mcp';
import { getEnabledWorkflows } from '../db/workflow-service';
import { recordWorkflowRun } from '../db/workflow-run-service';
import { getAccount } from '../db/account-service';
import { getJstHourMinute } from '$lib/datetime';
import { getWorkflowActionTool, parseStepRef, parseItemRef } from '$lib/workflow-tools';
import { WORKFLOW_FOREACH_MAX_ITEMS } from '$lib/constants';
import type {
	WorkflowStep,
	WorkflowActionStep,
	WorkflowForeachStep,
	WorkflowResultType
} from '$lib/types/chat';

type StepResult = { type: WorkflowResultType; value: boolean | number | string };
type ListResults = Map<string, Record<string, unknown>[]>;
type CurrentItem = Record<string, unknown> | null;

/** ワークフロー実行を即時中断させるためのエラー（未定義の変数参照・未対応ツール等）。 */
class WorkflowAbortError extends Error {}

function resolveOperand(operand: string, results: Map<string, StepResult>, currentItem: CurrentItem): StepResult {
	const itemField = parseItemRef(operand);
	if (itemField !== null) {
		if (!currentItem) throw new WorkflowAbortError(`@item参照はforeachの中でのみ使用できます: ${operand}`);
		const v = currentItem[itemField];
		if (v === undefined) throw new WorkflowAbortError(`現在の項目に存在しないフィールドです: ${itemField}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	const refId = parseStepRef(operand);
	if (refId === null) return { type: 'string', value: operand };
	const found = results.get(refId);
	if (!found) throw new WorkflowAbortError(`参照先のステップ結果が見つかりません: ${refId}`);
	return found;
}

function compare(left: StepResult, operator: string, right: StepResult): boolean {
	let rv: boolean | number | string = right.value;
	if (left.type === 'number') rv = typeof rv === 'number' ? rv : Number(rv);
	else if (left.type === 'boolean') rv = typeof rv === 'boolean' ? rv : rv === 'true';
	const lv = left.value;
	switch (operator) {
		case '==':
			return lv === rv;
		case '!=':
			return lv !== rv;
		case '>':
			return (lv as number) > (rv as number);
		case '<':
			return (lv as number) < (rv as number);
		case '>=':
			return (lv as number) >= (rv as number);
		case '<=':
			return (lv as number) <= (rv as number);
		default:
			throw new WorkflowAbortError(`未対応の演算子です: ${operator}`);
	}
}

async function runAction(
	db: Db,
	step: WorkflowActionStep,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	selfEmail: string | null,
	currentItem: CurrentItem
): Promise<void> {
	const toolDef = getWorkflowActionTool(step.tool);
	if (!toolDef) throw new WorkflowAbortError(`未対応のツールです: ${step.tool}`);

	const resolvedParams: Record<string, string | number> = {};
	for (const field of toolDef.params) {
		const raw = step.params?.[field.key];
		if (!raw) continue;
		const value = resolveOperand(raw, results, currentItem).value;
		if (field.type === 'number') {
			resolvedParams[field.key] = Number(value);
		} else if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
			// <input type="date"> の "YYYY-MM-DD" は new Date() でUTC深夜と解釈されJSTと9時間ズレるため、
			// JSTのウォールクロックとして明示的にオフセットを付与する（until は当日いっぱいを含めるため終端時刻にする）
			resolvedParams[field.key] = `${value}T${field.key === 'until' ? '23:59:59' : '00:00:00'}+09:00`;
		} else {
			resolvedParams[field.key] = String(value);
		}
	}

	let input: Record<string, unknown> = resolvedParams;
	if (step.tool === 'send_email') {
		if (!selfEmail) throw new WorkflowAbortError('送信先（自分のメールアドレス）が特定できません');
		input = { ...resolvedParams, to: selfEmail };
	} else if (step.tool === 'get_entities') {
		// entity_type_id はカタログのparamsに含めず、エディタの「対象」選択で直接 step.params に設定される
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`「${step.label}」の対象テーブルが選択されていません`);
		input = { ...resolvedParams, entity_type_id: entityTypeId };
	}

	const raw = await dispatchTool(db, step.tool as ToolName, input, env);

	if (toolDef.resultType && toolDef.extractResult) {
		results.set(step.id, { type: toolDef.resultType, value: toolDef.extractResult(raw) });
	}
	if (toolDef.listResult) {
		listResults.set(step.id, toolDef.listResult.extractList(raw));
	}
}

async function runForeach(
	db: Db,
	step: WorkflowForeachStep,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	selfEmail: string | null
): Promise<void> {
	const refId = parseStepRef(step.source);
	if (!refId) throw new WorkflowAbortError(`「${step.label}」の対象が選択されていません`);
	const items = listResults.get(refId);
	if (!items) throw new WorkflowAbortError(`「${step.label}」の参照先のリスト結果が見つかりません: ${refId}`);
	for (const item of items.slice(0, WORKFLOW_FOREACH_MAX_ITEMS)) {
		await runSteps(db, step.body, results, listResults, env, selfEmail, item);
	}
}

async function runSteps(
	db: Db,
	steps: WorkflowStep[],
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	selfEmail: string | null,
	currentItem: CurrentItem = null
): Promise<void> {
	for (const step of steps) {
		if (step.kind === 'action') {
			await runAction(db, step, results, listResults, env, selfEmail, currentItem);
		} else if (step.kind === 'condition') {
			const left = resolveOperand(step.left, results, currentItem);
			const right = resolveOperand(step.right, results, currentItem);
			if (compare(left, step.operator, right)) {
				await runSteps(db, step.then, results, listResults, env, selfEmail, currentItem);
			}
		} else {
			await runForeach(db, step, results, listResults, env, selfEmail);
		}
	}
}

export type WorkflowRunResult = { id: string; name: string; ok: boolean; error?: string };

/** 毎分のCronから呼ばれる。現在のJST時刻に一致する有効なワークフローを実行する。 */
export async function processDueWorkflows(
	db: Db,
	env?: ToolEnv,
	now: Date = new Date()
): Promise<WorkflowRunResult[]> {
	const { hour, minute } = getJstHourMinute(now);
	const due = (await getEnabledWorkflows(db)).filter(
		(w) => w.triggerHour === hour && w.triggerMinute === minute
	);

	const results: WorkflowRunResult[] = [];
	for (const workflow of due) {
		const startedAt = new Date();
		try {
			const account = workflow.accountId ? await getAccount(db, workflow.accountId) : null;
			// send_notification 等、env.accountId を「通知・登録の宛先」として参照するツールのために、
			// ワークフローの登録者をこの実行スコープのアカウントとして引き渡す
			const toolEnv: ToolEnv | undefined = workflow.accountId
				? { ...(env ?? {}), accountId: workflow.accountId }
				: env;
			await runSteps(db, workflow.steps, new Map(), new Map(), toolEnv, account?.email ?? null);
			results.push({ id: workflow.id, name: workflow.name, ok: true });
			await recordWorkflowRun(db, {
				workflowId: workflow.id,
				ok: true,
				startedAt,
				finishedAt: new Date()
			});
		} catch (e) {
			const error = e instanceof Error ? e.message : String(e);
			results.push({ id: workflow.id, name: workflow.name, ok: false, error });
			await recordWorkflowRun(db, {
				workflowId: workflow.id,
				ok: false,
				error,
				startedAt,
				finishedAt: new Date()
			});
		}
	}
	return results;
}
