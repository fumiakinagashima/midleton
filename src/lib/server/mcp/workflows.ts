import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import type { ToolEnv } from './shared';
import { createWorkflow, listWorkflows } from '../db/workflow-service';
import { validateWorkflow } from '$lib/workflow-validation';
import type { WorkflowStep } from '$lib/types/chat';

const workflowStepSchema: z.ZodType<WorkflowStep> = z.lazy(() =>
	z.union([
		z.object({
			id: z.string(),
			kind: z.literal('action'),
			label: z.string(),
			tool: z.string(),
			params: z.record(z.string(), z.string()).optional()
		}),
		z.object({
			id: z.string(),
			kind: z.literal('condition'),
			label: z.string(),
			left: z.string(),
			operator: z.enum(['==', '!=', '>', '<', '>=', '<=']),
			right: z.string(),
			then: z.array(workflowStepSchema)
		})
	])
);

const saveWorkflowInputSchema = z.object({
	name: z.string().min(1),
	triggerHour: z.number().int().min(0).max(23),
	triggerMinute: z.number().int().min(0).max(59),
	steps: z.array(workflowStepSchema)
});

export const tools: Tool[] = [
	{
		name: 'save_workflow',
		description:
			'ワークフロー定義をDBに保存する。提案した workflow コンポーネントの内容をそのまま保存する場合に使う（ユーザーがUIで編集した後の保存は「保存」ボタンで行われるため、AIがこのツールを呼ぶ必要はない）。保存後は /database/workflows で確認・管理できる（実行には別途有効化が必要）。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'ワークフロー名' },
				triggerHour: { type: 'number', description: '実行時刻（時、0-23、JST）' },
				triggerMinute: { type: 'number', description: '実行時刻（分、0-59、JST）' },
				steps: {
					type: 'array',
					description: 'ステップの配列（action または condition）'
				}
			},
			required: ['name', 'triggerHour', 'triggerMinute', 'steps']
		}
	},
	{
		name: 'list_workflows',
		description:
			'保存済みのワークフロー一覧を取得する。「どんなワークフローが設定されているか」「定期実行の設定を確認したい」などに使う。',
		input_schema: { type: 'object', properties: {} }
	}
];

export async function handleSaveWorkflow(db: Db, input: unknown, env?: ToolEnv) {
	const { name, triggerHour, triggerMinute, steps } = saveWorkflowInputSchema.parse(input);
	const validation = validateWorkflow(triggerHour, triggerMinute, steps);
	if (!validation.ok) {
		throw new Error(`ワークフローの内容に問題があります: ${validation.errors.join(' / ')}`);
	}
	const workflow = await createWorkflow(db, {
		name,
		steps,
		triggerHour,
		triggerMinute,
		accountId: env?.accountId
	});
	return {
		id: workflow.id,
		name: workflow.name,
		stepCount: workflow.steps.length,
		message: `ワークフロー「${workflow.name}」を保存しました（ステップ${workflow.steps.length}件）。/database/workflows から有効化すると実行されます。`
	};
}

export async function handleListWorkflows(db: Db, env?: ToolEnv) {
	const rows = await listWorkflows(db, env?.accountId);
	if (rows.length === 0) {
		return { workflows: [], message: '保存済みのワークフローはありません。' };
	}
	return {
		workflows: rows.map((r) => ({
			id: r.id,
			name: r.name,
			stepCount: r.steps.length,
			trigger: `${String(r.triggerHour).padStart(2, '0')}:${String(r.triggerMinute).padStart(2, '0')}`,
			enabled: r.enabled,
			createdAt: r.createdAt.toISOString()
		}))
	};
}
