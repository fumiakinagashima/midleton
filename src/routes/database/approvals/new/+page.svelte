<script lang="ts">
	import { goto } from '$app/navigation';
	import ApprovalForm from '$lib/components/dialog/ApprovalForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<header class="breadcrumb">
		<a href="/database">データ管理</a>
		<span class="sep">/</span>
		<a href="/database/approvals">申請管理</a>
		<span class="sep">/</span>
		<span>新規申請</span>
	</header>

	<ApprovalForm
		accountOptions={data.accountOptions}
		onCreated={(id) => goto(`/database/approvals/${id}`)}
		oncancel={() => goto('/database/approvals')}
	/>
</div>

<style lang="scss">
	.page {
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-width: 720px;
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
