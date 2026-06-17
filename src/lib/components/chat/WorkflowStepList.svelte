<script lang="ts">
	import type { WorkflowStep } from '$lib/types/chat';
	import {
		WORKFLOW_ACTION_TOOLS,
		WORKFLOW_OPERATORS,
		getWorkflowActionTool,
		makeStepRef,
		parseStepRef
	} from '$lib/workflow-tools';
	import type { VisibleStep } from '$lib/workflow-validation';
	import WorkflowStepList from './WorkflowStepList.svelte';

	type Props = {
		steps: WorkflowStep[];
		visibleBefore: VisibleStep[];
		editable: boolean;
		depth: number;
	};

	let { steps, visibleBefore, editable, depth }: Props = $props();

	function makeId(): string {
		return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	}

	function addStep(kind: 'action' | 'condition') {
		if (kind === 'action') {
			steps.push({ id: makeId(), kind: 'action', label: '新しいアクション', tool: '', params: {} });
		} else {
			steps.push({
				id: makeId(),
				kind: 'condition',
				label: '新しい条件',
				left: '',
				operator: '==',
				right: '',
				then: []
			});
		}
	}

	function removeStep(index: number) {
		steps.splice(index, 1);
	}

	function visibleUpTo(index: number): VisibleStep[] {
		const visible = [...visibleBefore];
		for (let i = 0; i < index; i++) {
			const s = steps[i];
			if (s.kind === 'action') {
				const tool = getWorkflowActionTool(s.tool);
				if (tool?.resultType) {
					visible.push({ id: s.id, label: s.label, resultType: tool.resultType, resultDesc: tool.resultDesc });
				}
			}
		}
		return visible;
	}
</script>

<div class="wf-steps">
	{#each steps as step, i (step.id)}
		{@const visible = visibleUpTo(i)}
		<div class="wf-step t-{step.kind}">
			<div class="wf-step-row">
				<span class="wf-step-no">{i + 1}.</span>
				<input
					type="text"
					class="wf-label-input"
					value={step.label}
					disabled={!editable}
					oninput={(e) => (step.label = e.currentTarget.value)}
				/>

				{#if step.kind === 'action'}
					<select
						value={step.tool}
						disabled={!editable}
						onchange={(e) => {
							step.tool = e.currentTarget.value;
							step.params = {};
						}}
					>
						<option value="">ツールを選択</option>
						{#each WORKFLOW_ACTION_TOOLS as t (t.value)}
							<option value={t.value}>{t.label}</option>
						{/each}
					</select>
				{/if}

				{#if editable}
					<button class="wf-del" onclick={() => removeStep(i)}>×</button>
				{/if}
			</div>

			{#if step.kind === 'action'}
				{@const tool = getWorkflowActionTool(step.tool)}
				{#if tool}
					{#each tool.params as field (field.key)}
						{@const refId = parseStepRef(step.params?.[field.key])}
						<div class="wf-line wf-param">
							<label for="wf-param-{step.id}-{field.key}">{field.label}</label>
							<select
								id="wf-param-{step.id}-{field.key}"
								value={refId ?? '__literal__'}
								disabled={!editable}
								onchange={(e) => {
									const v = e.currentTarget.value;
									if (!step.params) step.params = {};
									step.params[field.key] = v === '__literal__' ? '' : makeStepRef(v);
								}}
							>
								<option value="__literal__">直接入力</option>
								{#each visible as v (v.id)}
									<option value={v.id}>{v.label}の結果を使う</option>
								{/each}
							</select>
							{#if refId === null}
								{#if field.type === 'textarea'}
									<textarea
										value={step.params?.[field.key] ?? ''}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									></textarea>
								{:else}
									<input
										type="text"
										value={step.params?.[field.key] ?? ''}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									/>
								{/if}
							{/if}
						</div>
					{/each}
				{/if}
			{:else}
				{@const rightRef = parseStepRef(step.right)}
				<div class="wf-line wf-cond-line">
					<span class="wf-cond-label">判定:</span>
					<select
						value={parseStepRef(step.left) ?? ''}
						disabled={!editable}
						onchange={(e) => (step.left = e.currentTarget.value ? makeStepRef(e.currentTarget.value) : '')}
					>
						<option value="">選択してください</option>
						{#each visible as v (v.id)}
							<option value={v.id}>{v.label}{v.resultDesc ? `（${v.resultDesc}）` : ''}</option>
						{/each}
					</select>
					<select
						value={step.operator}
						disabled={!editable}
						onchange={(e) => (step.operator = e.currentTarget.value as typeof step.operator)}
					>
						{#each WORKFLOW_OPERATORS as op (op.value)}
							<option value={op.value}>{op.label}</option>
						{/each}
					</select>
					<select
						value={rightRef ?? '__literal__'}
						disabled={!editable}
						onchange={(e) => {
							const v = e.currentTarget.value;
							step.right = v === '__literal__' ? '' : makeStepRef(v);
						}}
					>
						<option value="__literal__">直接入力</option>
						{#each visible as v (v.id)}
							<option value={v.id}>{v.label}の結果</option>
						{/each}
					</select>
					{#if rightRef === null}
						<input
							type="text"
							value={step.right}
							disabled={!editable}
							oninput={(e) => (step.right = e.currentTarget.value)}
						/>
					{/if}
				</div>
			{/if}

			{#if step.kind === 'condition'}
				<div class="wf-then">
					<div class="wf-then-label">YES の場合:</div>
					<WorkflowStepList steps={step.then} visibleBefore={visible} {editable} depth={depth + 1} />
				</div>
			{/if}
		</div>
	{/each}

	{#if editable}
		<div class="wf-add-row">
			<button class="btn-add t-action" onclick={() => addStep('action')}>+ アクション</button>
			<button class="btn-add t-condition" onclick={() => addStep('condition')}>+ 条件</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.wf-steps {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.wf-step {
		border-left: 2px solid var(--color-border);
		padding-left: 10px;

		&.t-condition {
			border-left-color: #f59e0b;
		}
	}

	.wf-step-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		padding: 4px 0;
	}

	.wf-step-no {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.wf-label-input {
		font-weight: 600;
		min-width: 140px;
		flex: 1 1 160px;
	}

	.wf-cond-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.wf-line {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		padding: 2px 0 2px 22px;
	}

	input,
	select,
	textarea {
		padding: 4px 8px;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.8125rem;
		&:focus {
			outline: none;
			border-color: var(--color-primary);
		}
		&:disabled {
			opacity: 0.7;
		}
	}

	textarea {
		min-width: 220px;
		min-height: 32px;
	}

	.wf-param label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.wf-del {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 14px;
		padding: 0 4px;
		margin-left: auto;
		&:hover {
			color: #ef4444;
		}
	}

	.wf-then {
		margin: 4px 0 8px 16px;
		padding-left: 10px;
		border-left: 1px dashed var(--color-border);
	}

	.wf-then-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-bottom: 4px;
	}

	.wf-add-row {
		display: flex;
		gap: 6px;
		margin-top: 2px;
	}

	.btn-add {
		padding: 3px 10px;
		border-radius: 5px;
		font-size: 0.75rem;
		border: 1px solid;
		cursor: pointer;
		background: none;
		&:hover {
			opacity: 0.7;
		}
		&.t-action {
			color: #22c55e;
			border-color: #22c55e;
		}
		&.t-condition {
			color: #f59e0b;
			border-color: #f59e0b;
		}
	}
</style>
