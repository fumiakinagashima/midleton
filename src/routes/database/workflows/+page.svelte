<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatJstDateTime } from '$lib/datetime';
	import WorkflowDialog from '$lib/components/chat/WorkflowDialog.svelte';
	import type { WorkflowRow } from '$lib/server/db/workflow-service';
	import type { WorkflowContent } from '$lib/types/chat';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rows = $state<WorkflowRow[]>(untrack(() => data.rows));

	let deletingId = $state<string | null>(null);
	let showNewDialog = $state(false);

	const blankWorkflow: WorkflowContent = {
		type: 'workflow',
		name: '新規ワークフロー',
		triggerHour: 9,
		triggerMinute: 0,
		steps: []
	};

	function triggerLabel(row: WorkflowRow): string {
		return `毎日 ${String(row.triggerHour).padStart(2, '0')}:${String(row.triggerMinute).padStart(2, '0')}`;
	}

	async function deleteWorkflow(id: string, name: string) {
		if (!confirm(`ワークフロー「${name}」を削除しますか？`)) return;
		deletingId = id;
		try {
			const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				toast.error(((await res.json()) as { error?: string }).error ?? '削除に失敗しました');
				return;
			}
			rows = rows.filter((r) => r.id !== id);
			toast.success(`「${name}」を削除しました`);
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head><title>ワークフロー管理</title></svelte:head>

<div class="page">
	<div class="page-header">
		<h1>ワークフロー管理</h1>
		<button class="btn-primary" onclick={() => (showNewDialog = true)}>+ 新規作成</button>
	</div>

	{#if rows.length === 0}
		<div class="empty">
			<p>保存済みのワークフローはありません。</p>
			<button class="btn-primary" onclick={() => (showNewDialog = true)}>新規作成する</button>
		</div>
	{:else}
		<div class="wf-list">
			{#each rows as row (row.id)}
				<div class="wf-card">
					<span class="status-badge status-{row.enabled ? 'enabled' : 'disabled'}">
						{row.enabled ? '有効' : '無効'}
					</span>
					<div class="wf-card-info">
						<span class="wf-name">{row.name}</span>
						<span class="wf-meta">
							{triggerLabel(row)} · ステップ{row.steps.length}件 · {formatJstDateTime(row.updatedAt)} 更新
						</span>
					</div>
					<div class="wf-card-actions">
						<a href="/database/workflows/{row.id}" class="btn-secondary">編集</a>
						<button
							class="btn-danger"
							disabled={deletingId === row.id}
							onclick={() => deleteWorkflow(row.id, row.name)}
						>
							{deletingId === row.id ? '削除中…' : '削除'}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if showNewDialog}
		<WorkflowDialog
			workflow={blankWorkflow}
			entityTypes={data.entityTypes}
			slackIntegrations={data.slackIntegrations}
			onclose={() => (showNewDialog = false)}
			onsaved={(row) => {
				rows = [row, ...rows];
			}}
		/>
	{/if}
</div>

<style lang="scss">
	.page {
		padding: 24px 32px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;

		h1 {
			font-size: 1.375rem;
			font-weight: 700;
			color: var(--color-text);
		}
	}

	.btn-primary {
		padding: 7px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		text-decoration: none;
		&:hover {
			opacity: 0.88;
		}
	}

	.empty {
		text-align: center;
		padding: 60px 0;
		color: var(--color-text-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.wf-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
	}

	.wf-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 16px;
		background: var(--color-surface);

		&:not(:last-child) {
			border-bottom: 1px solid var(--color-border);
		}
	}

	.status-badge {
		flex-shrink: 0;
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 500;
		white-space: nowrap;

		&.status-enabled {
			color: #16a34a;
			border-color: #16a34a;
		}
		&.status-disabled {
			color: var(--color-text-muted);
			border-color: var(--color-border);
		}
	}

	.wf-card-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.wf-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.wf-meta {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.wf-card-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.btn-secondary {
		padding: 5px 12px;
		border-radius: 5px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		text-decoration: none;
		&:hover {
			background: var(--color-border);
		}
	}

	.btn-danger {
		padding: 5px 12px;
		border-radius: 5px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		&:hover:not(:disabled) {
			border-color: #ef4444;
			color: #ef4444;
		}
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style>
