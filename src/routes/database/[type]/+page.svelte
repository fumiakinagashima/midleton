<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { TableInfo, RecordRow } from '$lib/server/db/table-service';

	const type = $derived($page.params.type);

	let info = $state<TableInfo | null>(null);
	let rows = $state<RecordRow[]>([]);
	let loading = $state(true);

	const listCols = $derived(info?.fields.filter(f => f.listable) ?? []);

	onMount(async () => {
		const res = await fetch(`/api/database/${type}/records`);
		if (!res.ok) { loading = false; return; }
		const data = await res.json() as { info: TableInfo; rows: RecordRow[] };
		info = data.info;
		rows = data.rows;
		loading = false;
	});

	function displayValue(row: RecordRow, key: string): string {
		const info_field = info?.fields.find(f => f.key === key);
		const val = row[key];
		if (val == null || val === '') return '—';
		if (info_field?.type === 'select') {
			return info_field.options?.find(o => o.value === String(val))?.label ?? String(val);
		}
		if (typeof val === 'number' && info_field?.type === 'number') {
			return new Intl.NumberFormat('ja-JP').format(val);
		}
		return String(val);
	}

	async function deleteRow(id: string) {
		if (!confirm('このレコードを削除しますか？')) return;
		await fetch(`/api/database/${type}/records/${id}`, { method: 'DELETE' });
		rows = rows.filter(r => r.id !== id);
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<span>{info?.label ?? type}</span>
		</div>
		<div class="header-actions">
			{#if type === 'deals'}
				<a href="/database/{type}/gantt" class="btn-schema">ガントチャート</a>
			{/if}
			<a href="/database/{type}/schema" class="btn-schema">スキーマ編集</a>
			<a href="/database/{type}/new" class="btn-primary">+ 新規作成</a>
		</div>
	</header>

	{#if loading}
		<p class="status">読み込み中...</p>
	{:else if rows.length === 0}
		<div class="empty">
			<p>レコードがありません。</p>
			<a href="/database/{type}/new" class="btn-primary">最初のレコードを作成</a>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						{#each listCols as col}
							<th>{col.label}</th>
						{/each}
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr onclick={() => location.href = `/database/${type}/${row.id}`} class="clickable-row">
							{#each listCols as col}
								<td>{displayValue(row, col.key)}</td>
							{/each}
							<td class="actions" onclick={(e) => e.stopPropagation()}>
								<a href="/database/{type}/{row.id}" class="action-link">詳細</a>
								<a href="/database/{type}/{row.id}/edit" class="action-link">編集</a>
								<button class="action-del" onclick={() => deleteRow(String(row.id))}>削除</button>
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

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn-schema {
		padding: 7px 14px;
		background: none;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-schema:hover { color: var(--color-text); border-color: var(--color-text-muted); }

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

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

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
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	tbody tr:last-child td { border-bottom: none; }

	.clickable-row { cursor: pointer; transition: background 0.1s; }
	.clickable-row:hover { background: var(--color-surface); }

	.actions {
		text-align: right;
		white-space: nowrap;
		width: 1%;
	}

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
