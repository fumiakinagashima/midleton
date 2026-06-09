<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { ApprovalRow, ApprovalStep } from '$lib/server/db/approval-service';

	const id = $derived($page.params.id);

	let row = $state<ApprovalRow | null>(null);
	let loading = $state(true);
	let actionLoading = $state(false);

	// Comment inputs per step index
	let comments = $state<Record<number, string>>({});

	const STATUS_LABELS: Record<string, string> = {
		pending: '審査中', approved: '承認済', rejected: '否決', cancelled: '取消'
	};
	const STATUS_COLORS: Record<string, string> = {
		pending: '#ca8a04', approved: '#16a34a', rejected: '#dc2626', cancelled: '#6b7280'
	};
	const STEP_ICONS: Record<string, string> = {
		pending: '○', approved: '✓', rejected: '✗'
	};

	onMount(async () => {
		await load();
		loading = false;
	});

	async function load() {
		const res = await fetch(`/api/approvals/${id}`);
		if (res.ok) row = await res.json() as ApprovalRow;
	}

	async function act(stepIndex: number, action: 'approve_step' | 'reject_step') {
		if (!row || actionLoading) return;
		actionLoading = true;
		try {
			const res = await fetch(`/api/approvals/${row.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, step: stepIndex, comment: comments[stepIndex] ?? '' })
			});
			if (res.ok) row = await res.json() as ApprovalRow;
		} finally {
			actionLoading = false;
		}
	}

	async function cancel() {
		if (!row || !confirm('この申請を取り消しますか？')) return;
		const res = await fetch(`/api/approvals/${row.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'cancel' })
		});
		if (res.ok) row = await res.json() as ApprovalRow;
	}

	function fmtDate(d: string | Date | null | undefined): string {
		if (!d) return '—';
		const dt = new Date(d);
		return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
	}

	function dataEntries(data: Record<string, unknown>): [string, string][] {
		return Object.entries(data).map(([k, v]) => [k, String(v ?? '')]);
	}
</script>

<div class="page">
	{#if loading}
		<p class="status">読み込み中...</p>
	{:else if !row}
		<p class="status">申請が見つかりません。</p>
	{:else}
		<header class="page-header">
			<div class="breadcrumb">
				<a href="/database">データ管理</a>
				<span class="sep">/</span>
				<a href="/database/approvals">申請管理</a>
				<span class="sep">/</span>
				<span>{row.title}</span>
			</div>
			{#if row.status === 'pending'}
				<button class="btn-cancel" onclick={cancel} disabled={actionLoading}>取り消し</button>
			{/if}
		</header>

		<!-- Summary -->
		<div class="summary-card">
			<div class="summary-head">
				<h1 class="title">{row.title}</h1>
				<span class="status-badge" style="color:{STATUS_COLORS[row.status]};border-color:{STATUS_COLORS[row.status]}">
					{STATUS_LABELS[row.status] ?? row.status}
				</span>
			</div>
			<div class="meta-row">
				<span class="meta-item"><span class="meta-label">種別</span><span class="type-badge">{row.type}</span></span>
				<span class="meta-item"><span class="meta-label">申請者</span>{row.submittedBy}</span>
				<span class="meta-item"><span class="meta-label">申請日</span>{fmtDate(row.createdAt)}</span>
				{#if row.entityType && row.entityId}
					<span class="meta-item">
						<span class="meta-label">関連</span>
						<a href="/database/{row.entityType}/{row.entityId}" class="entity-link">{row.entityType} #{row.entityId.slice(0, 8)}</a>
					</span>
				{/if}
			</div>
		</div>

		<!-- Data -->
		{#if Object.keys(row.data).length > 0}
			<section class="section">
				<h2 class="section-title">申請内容</h2>
				<div class="data-grid">
					{#each dataEntries(row.data) as [key, val]}
						<div class="data-row">
							<span class="data-key">{key}</span>
							<span class="data-val">{val}</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Route -->
		<section class="section">
			<h2 class="section-title">承認ルート</h2>
			{#if row.route.length === 0}
				<p class="empty-hint">承認ステップが設定されていません。</p>
			{:else}
				<div class="route-list">
					{#each row.route as step, i}
						{@const color = STATUS_COLORS[step.status] ?? '#6b7280'}
						<div class="step-card" class:step-active={step.status === 'pending' && row.status === 'pending'}>
							<div class="step-icon" style="color:{color};border-color:{color}">
								{STEP_ICONS[step.status] ?? '○'}
							</div>
							<div class="step-body">
								<div class="step-head">
									<span class="step-num">Step {step.step}</span>
									<span class="step-approver">{step.approver}</span>
									{#if step.role}<span class="step-role">{step.role}</span>{/if}
									{#if step.email}<span class="step-email">{step.email}</span>{/if}
									<span class="step-status" style="color:{color}">{STATUS_LABELS[step.status] ?? step.status}</span>
								</div>
								{#if step.comment}
									<p class="step-comment">"{step.comment}"</p>
								{/if}
								{#if step.acted_at}
									<p class="step-date">{fmtDate(step.acted_at)}</p>
								{/if}

								<!-- Action buttons for the current pending step -->
								{#if step.status === 'pending' && row.status === 'pending'}
									<div class="step-actions">
										<textarea
											class="comment-input"
											placeholder="コメント（任意）"
											bind:value={comments[i]}
											rows="2"
										></textarea>
										<div class="action-btns">
											<button
												class="btn-approve"
												onclick={() => act(i, 'approve_step')}
												disabled={actionLoading}
											>承認</button>
											<button
												class="btn-reject"
												onclick={() => act(i, 'reject_step')}
												disabled={actionLoading}
											>否決</button>
										</div>
									</div>
								{/if}
							</div>
						</div>
						{#if i < row.route.length - 1}
							<div class="step-connector"></div>
						{/if}
					{/each}
				</div>
			{/if}
		</section>
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
		max-width: 800px;
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

	.btn-cancel {
		padding: 6px 12px;
		background: none;
		border: 1px solid var(--color-danger, #dc2626);
		color: var(--color-danger, #dc2626);
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-cancel:hover { background: color-mix(in srgb, #dc2626 10%, transparent); }
	.btn-cancel:disabled { opacity: 0.4; cursor: not-allowed; }

	/* Summary card */
	.summary-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 18px 20px;
		background: var(--color-surface);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.summary-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
	}

	.status-badge {
		font-size: 0.75rem;
		padding: 3px 10px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 600;
		white-space: nowrap;
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.meta-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.type-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
	}

	.entity-link { color: var(--color-primary); text-decoration: none; font-size: 0.875rem; }
	.entity-link:hover { text-decoration: underline; }

	/* Data section */
	.section { display: flex; flex-direction: column; gap: 12px; }

	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.data-grid {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.data-row {
		display: flex;
		align-items: baseline;
		gap: 16px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.9375rem;
	}
	.data-row:last-child { border-bottom: none; }

	.data-key {
		width: 160px;
		flex-shrink: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.data-val { color: var(--color-text); }

	/* Route */
	.route-list { display: flex; flex-direction: column; }

	.step-card {
		display: flex;
		gap: 14px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-surface);
		transition: border-color 0.15s;
	}

	.step-card.step-active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
	}

	.step-connector {
		width: 2px;
		height: 12px;
		background: var(--color-border);
		margin-left: 23px;
	}

	.step-icon {
		width: 28px;
		height: 28px;
		border: 2px solid;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.step-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }

	.step-head {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}

	.step-num { font-size: 0.75rem; color: var(--color-text-muted); }
	.step-approver { font-weight: 600; font-size: 0.9375rem; }
	.step-role { font-size: 0.8125rem; color: var(--color-text-muted); }
	.step-email { font-size: 0.8125rem; color: var(--color-text-muted); }
	.step-status { font-size: 0.8125rem; font-weight: 600; margin-left: auto; }

	.step-comment {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-style: italic;
		margin: 0;
	}

	.step-date { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }

	.step-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }

	.comment-input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		resize: vertical;
		font-family: inherit;
		box-sizing: border-box;
	}
	.comment-input:focus { outline: none; border-color: var(--color-primary); }

	.action-btns { display: flex; gap: 8px; }

	.btn-approve {
		padding: 7px 18px;
		background: #16a34a;
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-approve:hover { background: #15803d; }
	.btn-approve:disabled { opacity: 0.4; cursor: not-allowed; }

	.btn-reject {
		padding: 7px 18px;
		background: none;
		color: #dc2626;
		border: 1px solid #dc2626;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-reject:hover { background: color-mix(in srgb, #dc2626 10%, transparent); }
	.btn-reject:disabled { opacity: 0.4; cursor: not-allowed; }

	.empty-hint { color: var(--color-text-muted); font-size: 0.875rem; }
	.status { color: var(--color-text-muted); font-size: 0.875rem; }
</style>
