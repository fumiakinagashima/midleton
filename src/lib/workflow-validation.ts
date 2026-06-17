import type { WorkflowStep, WorkflowResultType } from './types/chat';
import { getWorkflowActionTool, parseStepRef } from './workflow-tools';

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export type VisibleStep = {
	id: string;
	label: string;
	resultType: WorkflowResultType;
	resultDesc?: string;
};

/**
 * 各ステップの位置で「参照可能な先行ステップ（スカラー結果を持つアクションのみ）」を集める。
 * 条件の `then` の中だけで作られた結果は、`then` を抜けた後の兄弟ステップからは見えない
 * （その分岐が実行されたかどうか保証できないため）。
 */
export function collectVisibility(
	steps: WorkflowStep[],
	visibleBefore: VisibleStep[] = []
): Map<string, VisibleStep[]> {
	const out = new Map<string, VisibleStep[]>();
	walk(steps, visibleBefore, out);
	return out;
}

function walk(steps: WorkflowStep[], visibleBefore: VisibleStep[], out: Map<string, VisibleStep[]>) {
	let visible = visibleBefore;
	for (const step of steps) {
		out.set(step.id, visible);
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (tool?.resultType) {
				visible = [...visible, { id: step.id, label: step.label, resultType: tool.resultType, resultDesc: tool.resultDesc }];
			}
		} else {
			walk(step.then, visible, out);
			// then を抜けた後は、then 内で作られた結果を見せない（visible はここでは更新しない）
		}
	}
}

function resolveOperandType(
	operand: string,
	visible: VisibleStep[]
): { ok: true; type: WorkflowResultType } | { ok: false; error: string } {
	const refId = parseStepRef(operand);
	if (refId === null) return { ok: true, type: 'string' }; // リテラルは文字列として扱う
	const found = visible.find((v) => v.id === refId);
	if (!found) return { ok: false, error: `参照先のステップが見つかりません（または参照できる範囲外です）: ${refId}` };
	return { ok: true, type: found.resultType };
}

export function validateWorkflow(
	triggerHour: number,
	triggerMinute: number,
	steps: WorkflowStep[]
): ValidationResult {
	const errors: string[] = [];

	if (!Number.isInteger(triggerHour) || triggerHour < 0 || triggerHour > 23) {
		errors.push('トリガーの時刻（時）が不正です');
	}
	if (!Number.isInteger(triggerMinute) || triggerMinute < 0 || triggerMinute > 59) {
		errors.push('トリガーの時刻（分）が不正です');
	}
	if (steps.length === 0) {
		errors.push('ステップが1つもありません');
	}

	const visibility = collectVisibility(steps);

	function checkStep(step: WorkflowStep) {
		const visible = visibility.get(step.id) ?? [];
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (!tool) {
				errors.push(`「${step.label}」のアクションが選択されていません`);
				return;
			}
			for (const field of tool.params) {
				const value = step.params?.[field.key];
				if (field.required && !value) {
					errors.push(`「${step.label}」の「${field.label}」が未入力です`);
					continue;
				}
				if (value) {
					const refId = parseStepRef(value);
					if (refId !== null && !visible.some((v) => v.id === refId)) {
						errors.push(`「${step.label}」の「${field.label}」が参照する先行ステップが見つかりません`);
					}
				}
			}
		} else {
			if (!step.left) {
				errors.push(`「${step.label}」の判定対象が選択されていません`);
			} else {
				const leftRef = parseStepRef(step.left);
				if (leftRef === null) {
					errors.push(`「${step.label}」の判定対象は先行ステップの結果を選択してください`);
				} else if (!visible.some((v) => v.id === leftRef)) {
					errors.push(`「${step.label}」の判定対象（先行ステップ）が見つかりません`);
				}
			}
			if (!step.right) {
				errors.push(`「${step.label}」の比較先が未入力です`);
			} else {
				const rightResolved = resolveOperandType(step.right, visible);
				if (!rightResolved.ok) errors.push(`「${step.label}」の比較先: ${rightResolved.error}`);
			}
			if (step.then.length === 0) {
				errors.push(`「${step.label}」のYes時の処理が1つもありません`);
			}
			for (const child of step.then) checkStep(child);
		}
	}

	for (const step of steps) checkStep(step);

	return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
