<script lang="ts">
	import X from '$lib/components/icon/X.svelte';
	import Workflow, { type WorkflowState } from './Workflow.svelte';
	import WorkflowChatPanel from '$lib/components/database/WorkflowChatPanel.svelte';
	import { validateWorkflow } from '$lib/workflow-validation';
	import { toast } from '$lib/stores/toast.svelte';
	import type { WorkflowContent } from '$lib/types/chat';
	import type { WorkflowRow } from '$lib/server/db/workflow-service';
	import type { EntityTypeForWorkflow } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';

	type Props = {
		workflow: WorkflowContent;
		onclose: () => void;
		onsaved?: (row: WorkflowRow) => void;
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
	};

	let { workflow, onclose, onsaved, entityTypes = [], slackIntegrations = [] }: Props = $props();

	type WorkflowInstance = { getState: () => WorkflowState; setState: (def: WorkflowState) => void };
	let wfRef = $state<WorkflowInstance | null>(null);
	let saving = $state(false);

	async function handleSave() {
		if (saving || !wfRef) return;
		const state = wfRef.getState();
		const name = state.name.trim();
		if (!name) {
			toast.error('ワークフロー名を入力してください');
			return;
		}
		const validation = validateWorkflow(state.triggerHour, state.triggerMinute, state.steps, entityTypes, slackIntegrations);
		if (!validation.ok) {
			for (const msg of validation.errors) toast.error(msg);
			return;
		}
		saving = true;
		try {
			const isUpdate = !!workflow.id;
			const res = await fetch(isUpdate ? `/api/workflows/${workflow.id}` : '/api/workflows', {
				method: isUpdate ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...state, name })
			});
			if (!res.ok) {
				throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? '保存に失敗しました');
			}
			const saved = (await res.json()) as WorkflowRow;
			toast.success(
				isUpdate
					? `「${name}」を更新しました。`
					: `「${name}」を保存しました。/database/workflows から有効化してください。`
			);
			onsaved?.(saved);
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '保存に失敗しました');
		} finally {
			saving = false;
		}
	}
</script>

<!-- モーダルオーバーレイ（クリックしても閉じない） -->
<div class="overlay" role="presentation"></div>

<!-- ダイアログ本体 -->
<div class="dialog" role="dialog" aria-modal="true" aria-label={workflow.name}>
	<div class="dialog-header">
		<span class="dialog-title">{workflow.name || 'ワークフロー'}</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<!-- チャット側（左） -->
		<div class="chat-side">
			<WorkflowChatPanel
				getCurrent={() =>
					wfRef?.getState() ?? {
						name: workflow.name,
						triggerHour: workflow.triggerHour,
						triggerMinute: workflow.triggerMinute,
						steps: workflow.steps
					}}
				onApply={(state) => wfRef?.setState(state)}
			/>
		</div>

		<!-- ワークフロー編集側（右） -->
		<div class="workflow-side">
			<Workflow
				bind:this={wfRef}
				name={workflow.name}
				triggerHour={workflow.triggerHour}
				triggerMinute={workflow.triggerMinute}
				steps={workflow.steps}
				editable={true}
				{entityTypes}
				{slackIntegrations}
			/>
		</div>
	</div>

	<div class="dialog-footer">
		<button class="footer-cancel" onclick={onclose}>キャンセル</button>
		<button class="footer-submit" onclick={handleSave} disabled={saving}>
			{saving ? '保存中…' : '保存'}
		</button>
	</div>
</div>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 200;
		animation: fade-in 0.2s ease;
	}

	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: min(1080px, 95vw);
		height: min(780px, 92vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.dialog-body {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: 16px;
		padding: 16px 20px;
		overflow: hidden;
	}

	.chat-side {
		flex-shrink: 0;
		display: flex;
		min-height: 0;

		@media (max-width: 720px) {
			display: none;
		}
	}

	.workflow-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}

	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.footer-cancel {
		padding: 7px 18px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;

		&:hover {
			border-color: var(--color-text);
			color: var(--color-text);
		}
	}

	.footer-submit {
		padding: 7px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		cursor: pointer;
		transition: opacity 0.15s;

		&:hover:not(:disabled) {
			opacity: 0.88;
		}
		&:active:not(:disabled) {
			opacity: 0.75;
		}
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}
</style>
