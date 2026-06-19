<script lang="ts">
	import type {
		CustomerDetailCustomer,
		CustomerDetailContact,
		CustomerDetailDeal,
		CustomerDetailActivity
	} from '$lib/types/chat';
	import type { RecordFormSpec } from '$lib/components/database/field-adapter';

	type Props = {
		customer: CustomerDetailCustomer;
		contacts: CustomerDetailContact[];
		deals: CustomerDetailDeal[];
		activities: CustomerDetailActivity[];
		onOpenForm: (spec: RecordFormSpec) => void;
		onDelete?: () => void;
	};

	let { customer, contacts, deals, activities, onOpenForm, onDelete }: Props = $props();

	const CUSTOMER_STATUS_LABELS: Record<string, string> = {
		active: '有効',
		inactive: '無効'
	};

	const DEAL_STATUS_LABELS: Record<string, string> = {
		open: '商談中',
		won: '受注',
		lost: '失注'
	};

	const ACTIVITY_TYPE_LABELS: Record<string, string> = {
		note: 'メモ',
		call: '電話',
		email: 'メール',
		meeting: '面談',
		deal_created: '案件登録'
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

	<!-- 顧客情報 -->
	<section class="section">
		<div class="section-header">
			<h3 class="section-title">{customer.name}</h3>
			<div class="header-actions">
				<button class="action-btn" onclick={openEditCustomer}>情報を修正</button>
				{#if onDelete}
					<button class="action-btn danger" onclick={onDelete}>削除</button>
				{/if}
			</div>
		</div>
		<dl class="info-grid">
			{#if customer.status}
				<dt>ステータス</dt>
				<dd class="status-badge status-{customer.status}">
					{CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
				</dd>
			{/if}
			{#if customer.email}
				<dt>メール</dt><dd>{customer.email}</dd>
			{/if}
			{#if customer.phone}
				<dt>電話</dt><dd>{customer.phone}</dd>
			{/if}
			{#if customer.postal_code || customer.address}
				<dt>住所</dt>
				<dd>{[customer.postal_code, customer.address].filter(Boolean).join(' ')}</dd>
			{/if}
			{#if customer.website}
				<dt>ウェブ</dt>
				<dd><a href={customer.website} target="_blank" rel="noopener noreferrer">{customer.website}</a></dd>
			{/if}
			{#if customer.notes}
				<dt>備考</dt><dd class="notes">{customer.notes}</dd>
			{/if}
		</dl>
	</section>

	<!-- 担当者 -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">担当者</h4>
			<button class="action-btn" onclick={openNewContact}>+ 新規登録</button>
		</div>
		{#if contacts.length === 0}
			<p class="empty">担当者は登録されていません</p>
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

	<!-- 案件 -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">案件</h4>
			<button class="action-btn" onclick={openNewDeal}>+ 新規登録</button>
		</div>
		{#if deals.length === 0}
			<p class="empty">案件は登録されていません</p>
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
							<span class="item-meta">終了予定: {fmtDate(d.plannedEnd)}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- 活動履歴 -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">活動履歴</h4>
			<button class="action-btn" onclick={openNewActivity}>+ 新規登録</button>
		</div>
		{#if activities.length === 0}
			<p class="empty">活動履歴は登録されていません</p>
		{:else}
			<ul class="item-list">
				{#each activities as a}
					<li class="item-row">
						<span class="activity-type">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
						<span class="item-meta">{fmtDate(a.createdAt)}</span>
						<span class="activity-content">{a.content}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

</div>

<style lang="scss">
	.customer-detail {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		
	}

	/* ---- セクション ---- */
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

	/* ---- アクションボタン ---- */
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
			border-color: #dc2626;
			color: #dc2626;
			background: color-mix(in srgb, #dc2626 6%, transparent);
		}
	}

	/* ---- 顧客情報グリッド ---- */
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

	/* ---- ステータスバッジ ---- */
	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;

		&.status-active  { background: #dcfce7; color: #16a34a; }
		&.status-inactive { background: #f3f4f6; color: #6b7280; }
	}

	.deal-status {
		display: inline-flex;
		align-items: center;
		padding: 1px 7px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		flex-shrink: 0;

		&.status-open { background: #dbeafe; color: #2563eb; }
		&.status-won  { background: #dcfce7; color: #16a34a; }
		&.status-lost { background: #fee2e2; color: #dc2626; }
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

	/* ---- リスト ---- */
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
</style>
