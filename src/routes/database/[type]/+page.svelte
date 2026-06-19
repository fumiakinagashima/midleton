<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { RecordRow } from '$lib/server/db/table-service';
	import RecordDialog from '$lib/components/dialog/RecordDialog.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { LIST_PAGE_SIZE } from '$lib/constants';

	let { data }: { data: PageData } = $props();

	const type = $derived($page.params.type);
	const info = $derived(data.info);

	// 全テーブル（コア＋カスタム）の詳細/編集/登録をダイアログで開く
	let dialog = $state<{ recordId: string | null; view: 'detail' | 'form' } | null>(null);

	function openDetail(id: string) {
		dialog = { recordId: id, view: 'detail' };
	}
	function openCreate() {
		dialog = { recordId: null, view: 'form' };
	}
	function openEdit(id: string) {
		dialog = { recordId: id, view: 'form' };
	}
	async function refreshAfterDialog() {
		dialog = null;
		await invalidateAll();
	}

	let rows = $state<RecordRow[]>(untrack(() => data.rows));
	let pageNum = $state(1);
	$effect(() => {
		rows = data.rows;
	});
	// テーブル切り替え時はページを先頭へ
	$effect(() => {
		void type;
		pageNum = 1;
	});
	const totalPages = $derived(Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE)));
	$effect(() => {
		if (pageNum > totalPages) pageNum = totalPages;
	});
	const pagedRows = $derived(
		rows.length > LIST_PAGE_SIZE
			? rows.slice((pageNum - 1) * LIST_PAGE_SIZE, pageNum * LIST_PAGE_SIZE)
			: rows
	);

	const listCols = $derived(info?.fields.filter(f => f.listable) ?? []);
	const refLabels = $derived(data.refLabels);

	function displayValue(row: RecordRow, key: string): string {
		const info_field = info?.fields.find(f => f.key === key);
		const val = row[key];
		if (val == null || val === '') return '—';
		if (info_field?.type === 'recordSelect') {
			return refLabels?.[key]?.[String(val)] ?? String(val);
		}
		if (info_field?.type === 'select') {
			return info_field.options?.find(o => o.value === String(val))?.label ?? String(val);
		}
		if (typeof val === 'number' && info_field?.type === 'number') {
			return new Intl.NumberFormat('ja-JP').format(val);
		}
		return String(val);
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
			<button class="btn-primary" onclick={openCreate}>+ 新規作成</button>
		</div>
	</header>

	{#if rows.length === 0}
		<div class="empty">
			<p>レコードがありません。</p>
			<button class="btn-primary" onclick={openCreate}>最初のレコードを作成</button>
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
					{#each pagedRows as row}
						<tr onclick={() => openDetail(String(row.id))} class="clickable-row">
							{#each listCols as col}
								<td>{displayValue(row, col.key)}</td>
							{/each}
							<td class="actions" onclick={(e) => e.stopPropagation()}>
								<button class="action-link" onclick={() => openEdit(String(row.id))}>編集</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="list-footer">
			<span class="count">{rows.length}件</span>
			{#if totalPages > 1}
				<Pagination bind:page={pageNum} {totalPages} />
			{/if}
		</div>
	{/if}
</div>

{#if dialog && type}
	<RecordDialog
		{type}
		recordId={dialog.recordId}
		initialView={dialog.view}
		onclose={() => (dialog = null)}
		onSaved={refreshAfterDialog}
		onDeleted={refreshAfterDialog}
	/>
{/if}

<style lang="scss">
	.page {
		padding: 24px 32px;
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
		flex-shrink: 0;
	}

	.list-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 12px;
	}

	.list-footer .count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
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
		background: none;
		border: none;
		padding: 0;
		font-family: inherit;
		cursor: pointer;
	}

	.action-link:hover { text-decoration: underline; }

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
