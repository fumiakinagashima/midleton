<script lang="ts">
	import BizcardScanner from '$lib/components/bizcard/BizcardScanner.svelte';
</script>

<div class="page">
	<div class="header">
		<h1>名刺取り込み</h1>
		<p>名刺画像をアップロードすると、Claude が情報を自動抽出します</p>
	</div>

	<BizcardScanner />
</div>

<style>
	.page {
		padding: 40px;
		display: flex;
		flex-direction: column;
		gap: 32px;
		height: 100%;
		overflow-y: auto;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 6px;
	}
	.header p {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		margin: 0;
	}
</style>
