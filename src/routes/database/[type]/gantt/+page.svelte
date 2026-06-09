<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import GanttChart from '$lib/components/database/GanttChart.svelte';
	import type { RecordRow } from '$lib/server/db/table-service';

	const type = $derived($page.params.type);

	type Deal = {
		id: string;
		title: string;
		customerId: string;
		status: string;
		amount: number | null;
		plannedStart: string | null;
		plannedEnd: string | null;
	};

	type Customer = { id: string; name: string };

	let deals = $state<Deal[]>([]);
	let customers = $state<Customer[]>([]);
	let loading = $state(true);
	let tableLabel = $state('案件');

	onMount(async () => {
		if (type !== 'deals') { goto(`/database/${type}`); return; }

		const [dealRes, custRes] = await Promise.all([
			fetch('/api/database/deals/records'),
			fetch('/api/database/customers/records')
		]);

		if (dealRes.ok) {
			const data = await dealRes.json() as { info: { label: string }; rows: RecordRow[] };
			tableLabel = data.info.label;
			deals = data.rows.map(r => ({
				id: String(r.id),
				title: String(r.title ?? ''),
				customerId: String(r.customerId ?? ''),
				status: String(r.status ?? 'open'),
				amount: r.amount != null ? Number(r.amount) : null,
				plannedStart: r.plannedStart ? String(r.plannedStart) : null,
				plannedEnd: r.plannedEnd ? String(r.plannedEnd) : null
			}));
		}

		if (custRes.ok) {
			const data = await custRes.json() as { rows: RecordRow[] };
			customers = data.rows.map(r => ({ id: String(r.id), name: String(r.name ?? '') }));
		}

		loading = false;
	});

	async function handleDateChange(id: string, plannedStart: string, plannedEnd: string) {
		const res = await fetch(`/api/database/deals/records/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ plannedStart, plannedEnd })
		});
		if (res.ok) {
			deals = deals.map(d =>
				d.id === id ? { ...d, plannedStart, plannedEnd } : d
			);
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<a href="/database/{type}">{tableLabel}</a>
			<span class="sep">/</span>
			<span>ガントチャート</span>
		</div>
		<a href="/database/{type}" class="btn-list">リスト表示</a>
	</header>

	{#if loading}
		<p class="status">読み込み中...</p>
	{:else if deals.length === 0}
		<div class="empty">
			<p>案件データがありません。</p>
			<a href="/database/deals/new" class="btn-primary">案件を作成</a>
		</div>
	{:else}
		<div class="chart-wrap">
			<GanttChart {deals} {customers} onDateChange={handleDateChange} />
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 24px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
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

	.btn-list {
		padding: 6px 14px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
	}
	.btn-list:hover { color: var(--color-text); border-color: var(--color-text-muted); }

	.chart-wrap {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.status { padding: 24px; color: var(--color-text-muted); font-size: 0.875rem; }

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 40px 24px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.btn-primary {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border-radius: 6px;
		font-size: 0.875rem;
		text-decoration: none;
	}
</style>
