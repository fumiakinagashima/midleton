<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { RecordRow } from '$lib/server/db/table-service';
	import RecordDialog from '$lib/components/chat/RecordDialog.svelte';
	import { type CoreType } from '$lib/components/database/field-adapter';

	let { data }: { data: PageData } = $props();

	const type = $derived($page.params.type);
	const info = $derived(data.info);

	const CORE_TYPES = ['customers', 'contacts', 'deals', 'activities'];
	const isCoreType = $derived(!!type && CORE_TYPES.includes(type));

	// コアテーブルはダイアログで詳細/編集/登録。カスタムテーブルは従来どおりフルページ遷移。
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
	$effect(() => {
		rows = data.rows;
	});

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
			{#if isCoreType}
				<button class="btn-primary" onclick={openCreate}>+ 新規作成</button>
			{:else}
				<a href="/database/{type}/new" class="btn-primary">+ 新規作成</a>
			{/if}
		</div>
	</header>

	{#if rows.length === 0}
		<div class="empty">
			<p>レコードがありません。</p>
			{#if isCoreType}
				<button class="btn-primary" onclick={openCreate}>最初のレコードを作成</button>
			{:else}
				<a href="/database/{type}/new" class="btn-primary">最初のレコードを作成</a>
			{/if}
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
						<tr
							onclick={() => isCoreType ? openDetail(String(row.id)) : (location.href = `/database/${type}/${row.id}`)}
							class="clickable-row"
						>
							{#each listCols as col}
								<td>{displayValue(row, col.key)}</td>
							{/each}
							<td class="actions" onclick={(e) => e.stopPropagation()}>
								{#if isCoreType}
									<button class="action-link" onclick={() => openEdit(String(row.id))}>編集</button>
								{:else}
									<a href="/database/{type}/{row.id}/edit" class="action-link">編集</a>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if dialog && isCoreType}
	<RecordDialog
		type={type as CoreType}
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
