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
	import GripVertical from '$lib/components/icon/GripVertical.svelte';
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

	// ドラッグ&ドロップによる並び替え（同じ steps 配列内、つまり同じスコープ内のみ）
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		e.dataTransfer?.setData('text/plain', String(index));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(e: DragEvent, index: number) {
		if (draggedIndex === null) return;
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, to: number) {
		e.preventDefault();
		const from = draggedIndex;
		draggedIndex = null;
		dragOverIndex = null;
		if (from === null || from === to) return;
		const [moved] = steps.splice(from, 1);
		const insertIndex = from < to ? to - 1 : to;
		steps.splice(insertIndex, 0, moved);
	}
</script>

<div class="wf-steps">
	{#each steps as step, i (step.id)}
		{@const visible = visibleUpTo(i)}
		<div
			class="wf-step t-{step.kind}"
			class:dragging={editable && draggedIndex === i}
			class:drag-over={editable && dragOverIndex === i && draggedIndex !== i}
			ondragover={editable ? (e) => handleDragOver(e, i) : undefined}
			ondrop={editable ? (e) => handleDrop(e, i) : undefined}
			role="group"
		>
			<div class="wf-step-row">
				{#if editable}
					<span
						class="wf-drag-handle"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, i)}
						ondragend={handleDragEnd}
						title="ドラッグして並び替え"
						role="button"
						tabindex="0"
					>
						<GripVertical size={14} />
					</span>
				{/if}
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
								{:else if field.type === 'select'}
									<select
										value={step.params?.[field.key] ?? ''}
										disabled={!editable}
										onchange={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									>
										{#each field.options ?? [] as opt (opt.value)}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{:else if field.type === 'number'}
									<input
										type="number"
										value={step.params?.[field.key] ?? ''}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									/>
								{:else if field.type === 'date'}
									<input
										type="date"
										value={step.params?.[field.key] ?? ''}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									/>
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
					<WorkflowStepList steps={step.then} visibleBefore={visible} {editable} depth={depth + 1} />
				</div>
			{/if}
		</div>
	{/each}

	{#if editable && draggedIndex !== null}
		<div
			class="wf-drop-end"
			class:drag-over={dragOverIndex === steps.length}
			ondragover={(e) => handleDragOver(e, steps.length)}
			ondrop={(e) => handleDrop(e, steps.length)}
			role="group"
		></div>
	{/if}

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
		border-radius: 0 4px 4px 0;
		transition: background-color 0.1s, opacity 0.1s;

		&.t-condition {
			border-left-color: #d57c30;
		}

		&.dragging {
			opacity: 0.4;
		}

		&.drag-over {
			background: var(--color-primary-soft, rgba(99, 102, 241, 0.08));
			outline: 1px dashed var(--color-primary);
			outline-offset: -1px;
		}
	}

	.wf-step-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		padding: 4px 0;
	}

	.wf-drag-handle {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--color-text-muted);
		cursor: grab;
		&:hover {
			color: var(--color-text);
		}
		&:active {
			cursor: grabbing;
		}
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
		align-items: flex-start;
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

	.wf-param {
		input[type='text'] {
			min-width: 360px;
			flex: 1 1 360px;
		}
		textarea {
			min-width: 360px;
			min-height: 90px;
			flex: 1 1 360px;
		}
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

	.wf-drop-end {
		height: 10px;
		border-radius: 4px;
		margin: 2px 0;

		&.drag-over {
			background: var(--color-primary-soft, rgba(99, 102, 241, 0.08));
			outline: 1px dashed var(--color-primary);
			outline-offset: -1px;
		}
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
		color: #fff;
		&:hover {
			opacity: 0.85;
		}
		&.t-action {
			background: #22754e;
			border-color: #22754e;
		}
		&.t-condition {
			background: #d57c30;
			border-color: #d57c30;
		}
	}
</style>
