<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import Workflow, { type WorkflowState } from '$lib/components/chat/Workflow.svelte';
	import { validateWorkflow } from '$lib/workflow-validation';
	import type { WorkflowStep } from '$lib/types/chat';

	type Props = {
		id?: string;
		initialName?: string;
		initialTriggerHour?: number;
		initialTriggerMinute?: number;
		initialSteps?: WorkflowStep[];
		initialEnabled?: boolean;
	};

	let {
		id,
		initialName = '新規ワークフロー',
		initialTriggerHour = 9,
		initialTriggerMinute = 0,
		initialSteps = [],
		initialEnabled = false
	}: Props = $props();

	let enabled = $state(untrack(() => initialEnabled));
	let saving = $state(false);

	type WorkflowInstance = { getState: () => WorkflowState };
	let wfRef = $state<WorkflowInstance | null>(null);

	async function handleSave() {
		if (saving || !wfRef) return;
		const state = wfRef.getState();
		const name = state.name.trim();
		if (!name) {
			toast.error('ワークフロー名を入力してください');
			return;
		}
		const validation = validateWorkflow(state.triggerHour, state.triggerMinute, state.steps);
		if (!validation.ok) {
			for (const msg of validation.errors) toast.error(msg);
			return;
		}
		saving = true;
		try {
			const body = JSON.stringify({ ...state, name, enabled });
			if (id) {
				const res = await fetch(`/api/workflows/${id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body
				});
				if (!res.ok) {
					throw new Error(((await res.json()) as { error?: string }).error ?? '更新に失敗しました');
				}
				toast.success(`「${name}」を更新しました`);
			} else {
				const res = await fetch('/api/workflows', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body
				});
				if (!res.ok) {
					throw new Error(((await res.json()) as { error?: string }).error ?? '保存に失敗しました');
				}
				toast.success(`「${name}」を保存しました`);
			}
			goto('/database/workflows');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '保存に失敗しました');
		} finally {
			saving = false;
		}
	}
</script>

<div class="editor-wrap">
	<div class="editor-row1">
		<a href="/database/workflows" class="btn-back">← 一覧に戻る</a>
		<label class="enabled-toggle">
			<input type="checkbox" bind:checked={enabled} />
			有効化（毎日指定時刻に実行）
		</label>
		<button class="btn-save" onclick={handleSave} disabled={saving}>
			{saving ? '保存中…' : '保存'}
		</button>
	</div>

	<div class="editor-canvas">
		<Workflow
			bind:this={wfRef}
			name={initialName}
			triggerHour={initialTriggerHour}
			triggerMinute={initialTriggerMinute}
			steps={initialSteps}
			editable={true}
		/>
	</div>
</div>

<style lang="scss">
	.editor-wrap {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px 24px;
	}

	.editor-row1 {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.btn-back {
		padding: 5px 12px;
		border-radius: 5px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
		&:hover {
			color: var(--color-text);
		}
	}

	.enabled-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.btn-save {
		margin-left: auto;
		padding: 6px 20px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		&:hover:not(:disabled) {
			opacity: 0.88;
		}
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.editor-canvas {
		flex: 1;
	}
</style>
