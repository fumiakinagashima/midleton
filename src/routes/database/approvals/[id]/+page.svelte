<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import type { ApprovalRow } from '$lib/server/db/approval-service';
	import type { ApprovalReviewResult } from '../../../api/approvals/[id]/ai-review/+server';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	let row = $state<ApprovalRow | null>(untrack(() => data.row));
	$effect(() => {
		row = data.row;
	});

	let actionLoading = $state(false);
	let comments = $state<Record<number, string>>({});

	const STATUS_LABELS: Record<string, string> = {
		pending: m.approval_status_pending(), approved: m.approval_status_approved(),
		rejected: m.approval_status_rejected(), cancelled: m.approval_status_cancelled()
	};
	const STATUS_COLORS: Record<string, string> = {
		pending: '#ca8a04', approved: '#16a34a', rejected: '#dc2626', cancelled: '#6b7280'
	};
	const STEP_ICONS: Record<string, string> = {
		pending: '○', approved: '✓', rejected: '✗'
	};
	const RISK_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高' };
	const RISK_COLORS: Record<string, string> = { low: '#16a34a', medium: '#ca8a04', high: '#dc2626' };

	let aiReview = $state<ApprovalReviewResult | null>(null);
	let aiReviewLoading = $state(false);
	let aiReviewError = $state('');

	async function runAiReview() {
		if (!row || aiReviewLoading) return;
		aiReviewLoading = true;
		aiReviewError = '';
		aiReview = null;
		try {
			const res = await fetch(`/api/approvals/${row.id}/ai-review`, { method: 'POST' });
			const result = await res.json() as ApprovalReviewResult & { error?: string };
			if (!res.ok) {
				aiReviewError = result.error ?? 'AIレビューに失敗しました。';
				return;
			}
			aiReview = result;
		} catch (e) {
			aiReviewError = e instanceof Error ? e.message : String(e);
		} finally {
			aiReviewLoading = false;
		}
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

	function fmtSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	import type { Attachment } from '$lib/server/db/approval-service';

	function downloadHref(att: Attachment): string {
		if (att.key) return `/api/attachments/${att.key}?filename=${encodeURIComponent(att.name)}`;
		return `data:${att.mimeType};base64,${att.data}`;
	}
</script>

<div class="page">
	{#if !row}
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
				<button class="btn-danger-outline" onclick={cancel} disabled={actionLoading}>取り消し</button>
			{/if}
		</header>

		<!-- Header card -->
		<div class="summary-card">
			<div class="summary-head">
				<h1 class="title">{row.title}</h1>
				<span class="status-badge" style="color:{STATUS_COLORS[row.status]};border-color:{STATUS_COLORS[row.status]}">
					{STATUS_LABELS[row.status] ?? row.status}
				</span>
			</div>
			<div class="meta-row">
				{#if row.submittedBy}
					<span class="meta-item"><span class="meta-label">申請者</span>{row.submittedBy}</span>
				{/if}
				<span class="meta-item"><span class="meta-label">申請日</span>{fmtDate(row.createdAt)}</span>
				<span class="meta-item"><span class="meta-label">更新日</span>{fmtDate(row.updatedAt)}</span>
			</div>
		</div>

		<!-- Content -->
		{#if row.content}
			<section class="section">
				<h2 class="section-title">申請内容</h2>
				<div class="content-box">{row.content}</div>
			</section>
		{/if}

		<!-- AI Review -->
		{#if row.status === 'pending'}
			<section class="section">
				<div class="section-head">
					<h2 class="section-title">AIレビュー</h2>
					<button class="btn-ai-review" onclick={runAiReview} disabled={aiReviewLoading}>
						{#if aiReviewLoading}
							レビュー中...
						{:else if aiReview}
							✨ 再レビュー
						{:else}
							✨ AIにレビューしてもらう
						{/if}
					</button>
				</div>
				{#if aiReviewError}
					<p class="ai-review-error">{aiReviewError}</p>
				{/if}
				{#if aiReview}
					<div class="ai-review-box">
						<span class="risk-badge" style="color:{RISK_COLORS[aiReview.riskLevel]};border-color:{RISK_COLORS[aiReview.riskLevel]}">
							リスク: {RISK_LABELS[aiReview.riskLevel] ?? aiReview.riskLevel}
						</span>
						<p class="ai-review-summary">{aiReview.summary}</p>
						{#if aiReview.concerns.length > 0}
							<div class="ai-review-group">
								<h3 class="ai-review-group-title">問題点</h3>
								<ul class="ai-review-list ai-review-concerns">
									{#each aiReview.concerns as item}
										<li>{item}</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if aiReview.checks.length > 0}
							<div class="ai-review-group">
								<h3 class="ai-review-group-title">確認事項</h3>
								<ul class="ai-review-list ai-review-checks">
									{#each aiReview.checks as item}
										<li>{item}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Attachments -->
		{#if row.attachments.length > 0}
			<section class="section">
				<h2 class="section-title">添付ファイル</h2>
				<ul class="att-list">
					{#each row.attachments as att}
						<li class="att-item">
							<svg class="att-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
							</svg>
							<span class="att-name">{att.name}</span>
							<span class="att-size">{fmtSize(att.size)}</span>
							<a class="att-download" href={downloadHref(att)} download={att.name}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									<polyline points="7 10 12 15 17 10"/>
									<line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								ダウンロード
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Approval route -->
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
									{#if step.role}<span class="step-meta">{step.role}</span>{/if}
									{#if step.email}<span class="step-meta">{step.email}</span>{/if}
									<span class="step-status" style="color:{color}">{STATUS_LABELS[step.status] ?? step.status}</span>
								</div>
								{#if step.comment}
									<p class="step-comment">"{step.comment}"</p>
								{/if}
								{#if step.acted_at}
									<p class="step-date">{fmtDate(step.acted_at)}</p>
								{/if}
								{#if step.status === 'pending' && row.status === 'pending' && (!step.accountId || step.accountId === page.data.account?.id)}
									<div class="step-actions">
										<textarea
											class="comment-input"
											placeholder="コメント（任意）"
											bind:value={comments[i]}
											rows="2"
										></textarea>
										<div class="action-btns">
											<button class="btn-approve" onclick={() => act(i, 'approve_step')} disabled={actionLoading}>承認</button>
											<button class="btn-reject" onclick={() => act(i, 'reject_step')} disabled={actionLoading}>否決</button>
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

	.page-header { display: flex; align-items: center; justify-content: space-between; }

	.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 0.9375rem; }
	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.btn-danger-outline {
		padding: 6px 12px;
		background: none;
		border: 1px solid var(--color-danger, #dc2626);
		color: var(--color-danger, #dc2626);
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-danger-outline:hover { background: color-mix(in srgb, #dc2626 10%, transparent); }
	.btn-danger-outline:disabled { opacity: 0.4; cursor: not-allowed; }

	.summary-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 18px 20px;
		background: var(--color-surface);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.summary-head { display: flex; align-items: center; gap: 12px; }
	.title { font-size: 1.125rem; font-weight: 600; margin: 0; }
	.status-badge {
		font-size: 0.75rem;
		padding: 3px 10px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 600;
		white-space: nowrap;
	}
	.meta-row { display: flex; flex-wrap: wrap; gap: 16px; }
	.meta-item { display: flex; align-items: center; gap: 6px; font-size: 0.875rem; color: var(--color-text-muted); }
	.meta-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }

	.section { display: flex; flex-direction: column; gap: 10px; }
	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}
	.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

	/* AI Review */
	.btn-ai-review {
		padding: 6px 14px;
		background: none;
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-ai-review:hover { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
	.btn-ai-review:disabled { opacity: 0.5; cursor: not-allowed; }

	.ai-review-error {
		margin: 0;
		padding: 10px 14px;
		background: color-mix(in srgb, #dc2626 10%, transparent);
		border: 1px solid #dc2626;
		border-radius: 6px;
		color: #dc2626;
		font-size: 0.875rem;
	}

	.ai-review-box {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
	}
	.risk-badge {
		display: inline-flex;
		align-self: flex-start;
		font-size: 0.75rem;
		padding: 2px 10px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 600;
		white-space: nowrap;
	}
	.ai-review-summary { margin: 0; font-size: 0.9375rem; line-height: 1.7; }
	.ai-review-group { display: flex; flex-direction: column; gap: 6px; }
	.ai-review-group-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}
	.ai-review-list { margin: 0; padding-left: 1.4em; font-size: 0.875rem; line-height: 1.7; display: flex; flex-direction: column; gap: 4px; }
	.ai-review-concerns li::marker { color: #dc2626; }
	.ai-review-checks li::marker { color: #ca8a04; }

	.content-box {
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		font-size: 0.9375rem;
		line-height: 1.7;
		white-space: pre-wrap;
	}

	/* Attachments */
	.att-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
	.att-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 12px;
		border: 1px solid var(--color-border);
		border-radius: 7px;
		background: var(--color-surface);
		font-size: 0.875rem;
	}
	.att-icon { flex-shrink: 0; color: var(--color-text-muted); }
	.att-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.att-size { flex-shrink: 0; font-size: 0.8125rem; color: var(--color-text-muted); }
	.att-download {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.8125rem;
		flex-shrink: 0;
	}
	.att-download:hover { text-decoration: underline; }

	/* Route */
	.route-list { display: flex; flex-direction: column; }
	.step-card {
		display: flex;
		gap: 14px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-surface);
	}
	.step-card.step-active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
	}
	.step-connector { width: 2px; height: 12px; background: var(--color-border); margin-left: 23px; }
	.step-icon {
		width: 28px; height: 28px;
		border: 2px solid;
		border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		font-size: 0.875rem; font-weight: 700;
		flex-shrink: 0; margin-top: 2px;
	}
	.step-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.step-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
	.step-num { font-size: 0.75rem; color: var(--color-text-muted); }
	.step-approver { font-weight: 600; font-size: 0.9375rem; }
	.step-meta { font-size: 0.8125rem; color: var(--color-text-muted); }
	.step-status { font-size: 0.8125rem; font-weight: 600; margin-left: auto; }
	.step-comment { font-size: 0.875rem; color: var(--color-text-muted); font-style: italic; margin: 0; }
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
		background: #16a34a; color: #fff;
		border: none; border-radius: 6px;
		font-size: 0.875rem; cursor: pointer;
	}
	.btn-approve:hover { background: #15803d; }
	.btn-approve:disabled { opacity: 0.4; cursor: not-allowed; }
	.btn-reject {
		padding: 7px 18px;
		background: none; color: #dc2626;
		border: 1px solid #dc2626; border-radius: 6px;
		font-size: 0.875rem; cursor: pointer;
	}
	.btn-reject:hover { background: color-mix(in srgb, #dc2626 10%, transparent); }
	.btn-reject:disabled { opacity: 0.4; cursor: not-allowed; }

	.empty-hint { color: var(--color-text-muted); font-size: 0.875rem; }
	.status { color: var(--color-text-muted); font-size: 0.875rem; }
</style>
