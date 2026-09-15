<script lang="ts">
	import type {
		CustomerDetailCustomer,
		CustomerDetailContact,
		CustomerDetailDeal,
		CustomerDetailActivity
	} from '$lib/types/chat';
	import type { RecordFormSpec } from './field-adapter';
	import type { CustomerHealthScoreResult } from '../../../routes/api/customers/[id]/health-score/+server';

	type Props = {
		customer: CustomerDetailCustomer;
		contacts: CustomerDetailContact[];
		deals: CustomerDetailDeal[];
		activities: CustomerDetailActivity[];
		onOpenForm: (spec: RecordFormSpec) => void;
		onDelete?: () => void;
	};

	let { customer, contacts, deals, activities, onOpenForm, onDelete }: Props = $props();

	// ---- AI health score ----
	const HEALTH_LEVEL_LABELS: Record<string, string> = { good: 'Good', warning: 'Caution', risk: 'At risk' };

	type HealthScore = { score: number; level: string; summary: string; positives: string[]; concerns: string[]; updatedAt?: string | number | null };

	// Show the cached score initially if one is available when the detail loads
	function cachedHealthScore(): HealthScore | null {
		if (customer.healthScore == null || !customer.healthScoreLevel) return null;
		return {
			score: customer.healthScore,
			level: customer.healthScoreLevel,
			summary: customer.healthScoreSummary ?? '',
			positives: JSON.parse(customer.healthScorePositives ?? '[]'),
			concerns: JSON.parse(customer.healthScoreConcerns ?? '[]'),
			updatedAt: customer.healthScoreUpdatedAt
		};
	}

	let healthScore = $state<HealthScore | null>(cachedHealthScore());
	let healthLoading = $state(false);
	let healthError = $state('');

	async function runHealthScore() {
		if (healthLoading) return;
		healthLoading = true;
		healthError = '';
		try {
			const res = await fetch(`/api/customers/${customer.id}/health-score`, { method: 'POST' });
			const result = (await res.json()) as CustomerHealthScoreResult & { error?: string };
			if (!res.ok) {
				healthError = result.error ?? 'Failed to retrieve the health score.';
				return;
			}
			healthScore = result;
		} catch (e) {
			healthError = e instanceof Error ? e.message : String(e);
		} finally {
			healthLoading = false;
		}
	}

	const CUSTOMER_STATUS_LABELS: Record<string, string> = {
		active: 'Active',
		inactive: 'Inactive'
	};

	const DEAL_STATUS_LABELS: Record<string, string> = {
		open: 'In progress',
		won: 'Won',
		lost: 'Lost'
	};

	const ACTIVITY_TYPE_LABELS: Record<string, string> = {
		note: 'Note',
		call: 'Call',
		email: 'Email',
		meeting: 'Meeting',
		deal_created: 'Deal created'
	};

	function fmtDate(val: string | number | null | undefined): string {
		if (val == null || val === '') return '—';
		const d = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
		if (isNaN(d.getTime())) return String(val);
		return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
	}

	function fmtAmount(amount: number | null | undefined): string {
		if (amount == null) return '—';
		return `¥${amount.toLocaleString()}`;
	}

	function openEditCustomer() {
		onOpenForm({ type: 'customers', recordId: customer.id });
	}

	function openNewContact() {
		onOpenForm({ type: 'contacts', prefill: { customerId: customer.id } });
	}

	function openNewDeal() {
		onOpenForm({ type: 'deals', prefill: { customerId: customer.id } });
	}

	function openNewActivity() {
		onOpenForm({ type: 'activities', prefill: { customerId: customer.id } });
	}
</script>

<div class="customer-detail">

	<!-- Customer info -->
	<section class="section">
		<div class="section-header">
			<h3 class="section-title">{customer.name}</h3>
			<div class="header-actions">
				<button class="action-btn" onclick={openEditCustomer}>Edit info</button>
				{#if onDelete}
					<button class="action-btn danger" onclick={onDelete}>Delete</button>
				{/if}
			</div>
		</div>
		<dl class="info-grid">
			{#if customer.status}
				<dt>Status</dt>
				<dd class="status-badge status-{customer.status}">
					{CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
				</dd>
			{/if}
			{#if customer.email}
				<dt>Email</dt><dd>{customer.email}</dd>
			{/if}
			{#if customer.phone}
				<dt>Phone</dt><dd>{customer.phone}</dd>
			{/if}
			{#if customer.postal_code || customer.address}
				<dt>Address</dt>
				<dd>{[customer.postal_code, customer.address].filter(Boolean).join(' ')}</dd>
			{/if}
			{#if customer.website}
				<dt>Website</dt>
				<dd><a href={customer.website} target="_blank" rel="noopener noreferrer">{customer.website}</a></dd>
			{/if}
			{#if customer.notes}
				<dt>Notes</dt><dd class="notes">{customer.notes}</dd>
			{/if}
		</dl>
	</section>

	<!-- Contacts -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">Contacts</h4>
			<button class="action-btn" onclick={openNewContact}>+ Add</button>
		</div>
		{#if contacts.length === 0}
			<p class="empty">No contacts registered</p>
		{:else}
			<ul class="item-list">
				{#each contacts as c}
					<li class="item-row">
						<span class="item-name">{c.name}</span>
						{#if c.role || c.department}
							<span class="item-sub">{[c.role, c.department].filter(Boolean).join(' / ')}</span>
						{/if}
						{#if c.email}
							<span class="item-meta">{c.email}</span>
						{/if}
						{#if c.phone}
							<span class="item-meta">{c.phone}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Deals -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">Deals</h4>
			<button class="action-btn" onclick={openNewDeal}>+ Add</button>
		</div>
		{#if deals.length === 0}
			<p class="empty">No deals registered</p>
		{:else}
			<ul class="item-list">
				{#each deals as d}
					<li class="item-row">
						<span class="item-name">{d.title}</span>
						<span class="deal-status status-{d.status}">
							{DEAL_STATUS_LABELS[d.status] ?? d.status}
						</span>
						{#if d.amount != null}
							<span class="item-meta">{fmtAmount(d.amount)}</span>
						{/if}
						{#if d.plannedEnd}
							<span class="item-meta">Due: {fmtDate(d.plannedEnd)}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Activity history -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">Activity History</h4>
			<button class="action-btn" onclick={openNewActivity}>+ Add</button>
		</div>
		{#if activities.length === 0}
			<p class="empty">No activity history registered</p>
		{:else}
			<ul class="item-list">
				{#each activities as a}
					<li class="item-row">
						<span class="activity-type">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
						<span class="item-meta">{fmtDate(a.activityDate ?? a.createdAt)}</span>
						<span class="activity-content">{a.content}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- AI health score -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">AI Health Score</h4>
			<button class="action-btn" onclick={runHealthScore} disabled={healthLoading}>
				{healthLoading ? 'Evaluating…' : healthScore ? 'Re-evaluate' : 'Evaluate with AI'}
			</button>
		</div>
		<div class="health-body">
			{#if healthError}
				<p class="health-error">{healthError}</p>
			{:else if !healthScore}
				<p class="empty">Click "Evaluate with AI" to calculate a health score from activity history and deal status.</p>
			{:else}
				<div class="health-head">
					<span class="health-score health-{healthScore.level}">{healthScore.score}</span>
					<span class="health-level-badge health-{healthScore.level}">
						{HEALTH_LEVEL_LABELS[healthScore.level] ?? healthScore.level}
					</span>
					{#if healthScore.updatedAt}
						<span class="health-date">Evaluated {fmtDate(healthScore.updatedAt)}</span>
					{/if}
				</div>
				{#if healthScore.summary}
					<p class="health-summary">{healthScore.summary}</p>
				{/if}
				{#if healthScore.positives.length > 0}
					<div class="health-group">
						<span class="health-group-title">Positives</span>
						<ul class="health-list good">
							{#each healthScore.positives as item}<li>{item}</li>{/each}
						</ul>
					</div>
				{/if}
				{#if healthScore.concerns.length > 0}
					<div class="health-group">
						<span class="health-group-title">Concerns</span>
						<ul class="health-list risk">
							{#each healthScore.concerns as item}<li>{item}</li>{/each}
						</ul>
					</div>
				{/if}
			{/if}
		</div>
	</section>

</div>

<style lang="scss">
	.customer-detail {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		
	}

	/* ---- Section ---- */
	.section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-text);
	}

	.section-subtitle {
		font-size: 0.8125rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* ---- Action buttons ---- */
	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.action-btn {
		padding: 4px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;

		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, transparent);
		}

		&.danger:hover {
			border-color: var(--color-error);
			color: var(--color-error);
			background: color-mix(in srgb, var(--color-error) 6%, transparent);
		}
	}

	/* ---- Customer info grid ---- */
	.info-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 8px 16px;
		padding: 14px 16px;
		margin: 0;
		font-size: 0.875rem;

		dt {
			color: var(--color-text-muted);
			white-space: nowrap;
			display: flex;
			align-items: center;
		}

		dd {
			margin: 0;
			color: var(--color-text);
			word-break: break-all;
			display: flex;
			align-items: center;
		}

		dd.notes {
			white-space: pre-wrap;
			align-items: flex-start;
		}

		a {
			color: var(--color-primary);
			text-decoration: none;
			&:hover { text-decoration: underline; }
		}
	}

	/* ---- Status badge ---- */
	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;

		&.status-active  { background: var(--color-success-bg); color: var(--color-success); }
		&.status-inactive { background: var(--color-neutral-bg); color: var(--color-neutral); }
	}

	.deal-status {
		display: inline-flex;
		align-items: center;
		padding: 1px 7px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		flex-shrink: 0;

		&.status-open { background: var(--color-info-bg); color: var(--color-info); }
		&.status-won  { background: var(--color-success-bg); color: var(--color-success); }
		&.status-lost { background: var(--color-error-bg); color: var(--color-error); }
	}

	.activity-type {
		display: inline-flex;
		align-items: center;
		padding: 1px 7px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		background: var(--color-border);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	/* ---- List ---- */
	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;

		li + li {
			border-top: 1px solid var(--color-border);
		}
	}

	.item-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 16px;
		font-size: 0.875rem;
	}

	.item-name {
		font-weight: 500;
		color: var(--color-text);
	}

	.item-sub {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}

	.item-meta {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		margin-left: auto;
	}

	.activity-content {
		width: 100%;
		color: var(--color-text);
		line-height: 1.5;
		white-space: pre-wrap;
		font-size: 0.8125rem;
		margin-top: 2px;
	}

	.empty {
		padding: 12px 16px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ---- AI health score ---- */
	.health-body {
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.health-error {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-error);
	}

	.health-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.health-score {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;

		&.health-good { color: var(--color-success); }
		&.health-warning { color: var(--color-warning); }
		&.health-risk { color: var(--color-error); }
	}

	.health-level-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 10px;
		border-radius: 20px;
		border: 1px solid;
		font-size: 0.75rem;
		font-weight: 600;

		&.health-good { color: var(--color-success); border-color: var(--color-success); }
		&.health-warning { color: var(--color-warning); border-color: var(--color-warning); }
		&.health-risk { color: var(--color-error); border-color: var(--color-error); }
	}

	.health-date {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.health-summary {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.7;
		color: var(--color-text);
	}

	.health-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.health-group-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.health-list {
		margin: 0;
		padding-left: 1.4em;
		font-size: 0.875rem;
		line-height: 1.7;
		display: flex;
		flex-direction: column;
		gap: 2px;

		&.good li::marker { color: var(--color-success); }
		&.risk li::marker { color: var(--color-error); }
	}
</style>
