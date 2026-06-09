<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApprovalListRow } from '$lib/server/db/approval-service';
	import * as m from '$lib/paraglide/messages.js';

	let rows = $state<ApprovalListRow[]>([]);
	let loading = $state(true);

	const STATUS_LABELS: Record<string, string> = {
		pending: m.approval_status_pending(), approved: m.approval_status_approved(),
		rejected: m.approval_status_rejected(), cancelled: m.approval_status_cancelled()
	};
	const STATUS_COLORS: Record<string, string> = {
		pending: '#ca8a04', approved: '#16a34a', rejected: '#dc2626', cancelled: '#6b7280'
	};

	onMount(async () => {
		const res = await fetch('/api/approvals');
		if (res.ok) rows = (await res.json() as { rows: ApprovalListRow[] }).rows;
		loading = false;
	});

	function fmtDate(d: string | Date): string {
		const dt = new Date(d);
		return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
	}

	function currentApprover(row: ApprovalRow): string {
		const pending = row.route.find(s => s.status === 'pending');
		return pending?.approver ?? '—';
	}

	async function deleteRow(id: string) {
		if (!confirm('この申請を削除しますか？')) return;
		await fetch(`/api/approvals/${id}`, { method: 'DELETE' });
		rows = rows.filter(r => r.id !== id);
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<span>申請管理</span>
		</div>
		<a href="/database/approvals/new" class="btn-primary">+ 新規申請</a>
	</header>

	{#if loading}
		<p class="status">読み込み中...</p>
	{:else if rows.length === 0}
		<div class="empty">
			<p>申請がありません。</p>
			<a href="/database/approvals/new" class="btn-primary">最初の申請を作成</a>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>タイトル</th>
						<th>ステータス</th>
						<th>現在の承認者</th>
						<th>申請者</th>
						<th>申請日</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr onclick={() => location.href = `/database/approvals/${row.id}`} class="clickable-row">
							<td class="title-cell">{row.title}</td>
							<td>
								<span class="status-badge" style="color:{STATUS_COLORS[row.status]};border-color:{STATUS_COLORS[row.status]}">
									{STATUS_LABELS[row.status] ?? row.status}
								</span>
							</td>
							<td>{currentApprover(row)}</td>
							<td>{row.submittedBy}</td>
							<td>{fmtDate(row.createdAt)}</td>
							<td class="actions" onclick={(e) => e.stopPropagation()}>
								<a href="/database/approvals/{row.id}" class="action-link">詳細</a>
								<button class="action-del" onclick={() => deleteRow(row.id)}>削除</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 24px 32px;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
	}
	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.btn-primary {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.table-wrap {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
	thead { background: var(--color-surface); }
	th {
		padding: 9px 14px;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}
	td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--color-border);
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	tbody tr:last-child td { border-bottom: none; }

	.clickable-row { cursor: pointer; transition: background 0.1s; }
	.clickable-row:hover { background: var(--color-surface); }

	.title-cell { font-weight: 500; }

	.type-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
	}

	.status-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 500;
		white-space: nowrap;
	}

	.actions { text-align: right; white-space: nowrap; width: 1%; }
	.action-link {
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.8125rem;
		margin-right: 10px;
	}
	.action-link:hover { text-decoration: underline; }
	.action-del {
		background: none;
		border: none;
		color: var(--color-danger, #dc2626);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
	}
	.action-del:hover { text-decoration: underline; }

	.status { color: var(--color-text-muted); font-size: 0.875rem; }
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		margin-top: 32px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
