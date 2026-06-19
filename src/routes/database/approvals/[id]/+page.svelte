<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ApprovalDetail from '$lib/components/dialog/ApprovalDetail.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<header class="breadcrumb">
		<a href="/database">データ管理</a>
		<span class="sep">/</span>
		<a href="/database/approvals">申請管理</a>
		<span class="sep">/</span>
		<span>{data.row?.title ?? '詳細'}</span>
	</header>

	<ApprovalDetail initialRow={data.row} accountId={data.accountId} onChanged={() => invalidateAll()} />
</div>

<style lang="scss">
	.page {
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 800px;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;

		a { color: var(--color-primary); text-decoration: none; &:hover { text-decoration: underline; } }
		span:last-child { font-weight: 600; }
	}

	.sep { color: var(--color-text-muted); }
</style>
