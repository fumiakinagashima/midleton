<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import GanttChart from '$lib/components/database/GanttChart.svelte';
	import RecordDialog from '$lib/components/dialog/RecordDialog.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const type = $derived($page.params.type);
	const tableLabel = $derived(data.tableLabel);
	const customers = $derived(data.customers);

	let deals = $state(untrack(() => data.deals));
	$effect(() => {
		deals = data.deals;
	});

	// 案件詳細は一覧と同じくダイアログで開く（別ページへの遷移はしない）
	let dialogRecordId = $state<string | null>(null);
	function openDetail(id: string) {
		dialogRecordId = id;
	}
	async function refreshAfterDialog() {
		dialogRecordId = null;
		await invalidateAll();
	}

	// ── フィルタ ──────────────────────────────────────────────────────────
	const STATUS_OPTIONS = [
		{ value: 'open', label: '商談中' },
		{ value: 'won', label: '受注' },
		{ value: 'lost', label: '失注' }
	];

	const customerOptions = $derived(customers.map((c) => ({ value: c.id, label: c.name })));

	let filterCustomerId = $state('');
	let filterStatuses = $state<Set<string>>(new Set(STATUS_OPTIONS.map((s) => s.value)));
	let filterFrom = $state('');
	let filterTo = $state('');

	function toggleStatus(status: string) {
		const next = new Set(filterStatuses);
		if (next.has(status)) next.delete(status);
		else next.add(status);
		filterStatuses = next;
	}

	// 表示期間の指定は、期間未設定（plannedStart/End が空）の案件には適用しない
	// （ドラッグでバーを新規作成できる行として常に表示するため）
	function inPeriod(deal: (typeof deals)[number]): boolean {
		if (!filterFrom && !filterTo) return true;
		if (!deal.plannedStart || !deal.plannedEnd) return true;
		const dealStart = new Date(`${deal.plannedStart}T00:00:00+09:00`).getTime();
		const dealEnd = new Date(`${deal.plannedEnd}T00:00:00+09:00`).getTime();
		const from = filterFrom ? new Date(`${filterFrom}T00:00:00+09:00`).getTime() : -Infinity;
		const to = filterTo ? new Date(`${filterTo}T23:59:59+09:00`).getTime() : Infinity;
		return dealEnd >= from && dealStart <= to;
	}

	const filteredDeals = $derived(
		deals.filter(
			(d) =>
				(!filterCustomerId || d.customerId === filterCustomerId) &&
				filterStatuses.has(d.status) &&
				inPeriod(d)
		)
	);

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

	{#if deals.length === 0}
		<div class="empty">
			<p>案件データがありません。</p>
			<a href="/database/deals/new" class="btn-primary">案件を作成</a>
		</div>
	{:else}
		<div class="filters">
			<div class="filter-item customer">
				<Select label="顧客" bind:value={filterCustomerId} options={customerOptions} placeholder="すべて" />
			</div>
			<div class="filter-item status">
				<span class="filter-label">状況</span>
				<div class="status-checks">
					{#each STATUS_OPTIONS as opt}
						<label class="status-check">
							<input
								type="checkbox"
								checked={filterStatuses.has(opt.value)}
								onchange={() => toggleStatus(opt.value)}
							/>
							{opt.label}
						</label>
					{/each}
				</div>
			</div>
			<div class="filter-item period">
				<span class="filter-label">表示期間</span>
				<div class="period-inputs">
					<DatePicker bind:value={filterFrom} max={filterTo || undefined} />
					<span class="period-sep">〜</span>
					<DatePicker bind:value={filterTo} min={filterFrom || undefined} />
				</div>
			</div>
		</div>

		{#if filteredDeals.length === 0}
			<p class="no-match">フィルタ条件に一致する案件がありません。</p>
		{:else}
			<div class="chart-wrap">
				<GanttChart deals={filteredDeals} {customers} onDateChange={handleDateChange} onDealClick={openDetail} />
			</div>
		{/if}
	{/if}
</div>

{#if dialogRecordId}
	<RecordDialog
		type="deals"
		recordId={dialogRecordId}
		initialView="detail"
		onclose={() => (dialogRecordId = null)}
		onSaved={refreshAfterDialog}
		onDeleted={refreshAfterDialog}
	/>
{/if}

<style lang="scss">
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

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 20px;
		padding: 14px 24px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.filter-item.customer {
		width: 200px;
	}

	.filter-label {
		display: block;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 4px;
	}

	.status-checks {
		display: flex;
		align-items: center;
		gap: 14px;
		height: 37px;
	}

	.status-check {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9375rem;
		color: var(--color-text);
		cursor: pointer;
		white-space: nowrap;
	}

	.status-check input {
		width: 16px;
		height: 16px;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.period-inputs {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.period-sep {
		color: var(--color-text-muted);
	}

	.no-match {
		padding: 40px 24px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.chart-wrap {
		flex: 1;
		padding: 4px 0 4px 24px;
		display: flex;
		flex-direction: column;
	}

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
