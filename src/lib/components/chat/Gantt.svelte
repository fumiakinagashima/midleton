<script lang="ts">
	import { onMount } from 'svelte';
	import GanttChart from '$lib/components/database/GanttChart.svelte';
	import Expand from '$lib/components/icon/Expand.svelte';
	import Shrink from '$lib/components/icon/Shrink.svelte';
	import type { RecordRow } from '$lib/server/db/table-service';

	type Filter = { status?: string[]; customerId?: string };

	type Props = {
		title?: string;
		filter?: Filter;
		expanded?: boolean;
		onToggleExpand?: () => void;
		onDealClick?: (id: string) => void;
	};

	let { title, filter, expanded = false, onToggleExpand, onDealClick }: Props = $props();

	type Deal = {
		id: string; title: string; customerId: string;
		status: string; amount: number | null;
		plannedStart: string | null; plannedEnd: string | null;
	};
	type Customer = { id: string; name: string };

	let deals = $state<Deal[]>([]);
	let customers = $state<Customer[]>([]);
	let loading = $state(true);

	const displayDeals = $derived(
		deals.filter(d => {
			if (filter?.status && !filter.status.includes(d.status)) return false;
			if (filter?.customerId && d.customerId !== filter.customerId) return false;
			return true;
		})
	);

	onMount(async () => {
		const [dealRes, custRes] = await Promise.all([
			fetch('/api/database/deals/records'),
			fetch('/api/database/customers/records')
		]);
		if (dealRes.ok) {
			const data = await dealRes.json() as { rows: RecordRow[] };
			deals = data.rows.map(r => ({
				id: String(r.id), title: String(r.title ?? ''),
				customerId: String(r.customerId ?? ''), status: String(r.status ?? 'open'),
				amount: r.amount != null ? Number(r.amount) : null,
				plannedStart: r.plannedStart ? String(r.plannedStart) : null,
				plannedEnd:   r.plannedEnd   ? String(r.plannedEnd)   : null
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
			deals = deals.map(d => d.id === id ? { ...d, plannedStart, plannedEnd } : d);
		}
	}
</script>

<div class="gantt-card">
	{#if title || onToggleExpand}
		<div class="card-title">
			<span class="card-title-text">{title ?? ''}</span>
			{#if onToggleExpand}
				<button
					type="button"
					class="expand-btn"
					onclick={onToggleExpand}
				>
					{#if expanded}
						<Shrink size={14} />
						<span>Collapse</span>
					{:else}
						<Expand size={14} />
						<span>Expand</span>
					{/if}
				</button>
			{/if}
		</div>
	{/if}
	{#if loading}
		<p class="loading">Loading...</p>
	{:else if displayDeals.length === 0}
		<p class="empty">No deals to display.</p>
	{:else}
		<div class="chart-wrap">
			<GanttChart deals={displayDeals} {customers} onDateChange={handleDateChange} {onDealClick} />
		</div>
	{/if}
</div>

<style lang="scss">
	.gantt-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
		width: 100%;
	}

	.card-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		font-size: 0.875rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.card-title-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.expand-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border-radius: 6px;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 0.75rem;
		font-weight: 400;
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.expand-btn:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.loading, .empty {
		padding: 20px 14px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.chart-wrap {
		height: 320px;
		display: flex;
		flex-direction: column;
	}
</style>
